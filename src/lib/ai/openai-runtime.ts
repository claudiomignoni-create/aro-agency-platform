import OpenAI from "openai";
import type {
  FunctionTool,
  Response,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ToolChoiceFunction,
  ToolChoiceOptions
} from "openai/resources/responses/responses";
import {
  executeTool,
  getToolDefinitionsForRole,
  isToolAllowedForRole,
  isToolName,
  type JsonValue,
  type ToolDefinition,
  type ToolName
} from "@/lib/ai/tools";
import type { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AssistantToolCallAudit = {
  duration_ms: number;
  error: string | null;
  input: Record<string, JsonValue>;
  output: JsonValue | null;
  status: "error" | "success";
  tool_name: string;
};

type RunOpenAIAssistantInput = {
  apiKey: string;
  message: string;
  profile: Profile;
  requestedTool?: ToolName;
  supabase: SupabaseServerClient;
};

type RunOpenAIAssistantResult = {
  message: string;
  model: string;
  responseId: string | null;
  toolCalls: AssistantToolCallAudit[];
};

const defaultModel = "gpt-4.1-mini";
const maxToolRounds = 4;

export class AssistantRuntimeError extends Error {
  responseId: string | null;
  toolCalls: AssistantToolCallAudit[];

  constructor(
    message: string,
    {
      responseId,
      toolCalls
    }: {
      responseId: string | null;
      toolCalls: AssistantToolCallAudit[];
    }
  ) {
    super(message);
    this.name = "AssistantRuntimeError";
    this.responseId = responseId;
    this.toolCalls = toolCalls;
  }
}

export async function runOpenAIAssistant({
  apiKey,
  message,
  profile,
  requestedTool,
  supabase
}: RunOpenAIAssistantInput): Promise<RunOpenAIAssistantResult> {
  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? defaultModel;
  const tools = getToolDefinitionsForRole(profile.role).map(toOpenAITool);
  const toolCalls: AssistantToolCallAudit[] = [];
  const toolChoice = getToolChoice(profile.role, requestedTool);
  let responseId: string | null = null;

  try {
    let response = await openai.responses.create({
      input: message,
      instructions: getSystemInstructions(profile.role),
      max_output_tokens: 700,
      model,
      parallel_tool_calls: false,
      store: false,
      tool_choice: toolChoice,
      tools
    });

    responseId = response.id;

    for (let round = 0; round < maxToolRounds; round += 1) {
      const functionCalls = getFunctionCalls(response);

      if (functionCalls.length === 0) {
        return {
          message: getAssistantText(response),
          model,
          responseId,
          toolCalls
        };
      }

      const toolOutputs = await Promise.all(
        functionCalls.map((toolCall) =>
          executeOpenAIToolCall({
            profile,
            supabase,
            toolCall,
            toolCalls
          })
        )
      );

      response = await openai.responses.create({
        input: toolOutputs,
        instructions: getSystemInstructions(profile.role),
        max_output_tokens: 700,
        model,
        parallel_tool_calls: false,
        previous_response_id: response.id,
        store: false,
        tool_choice: "auto",
        tools
      });
      responseId = response.id;
    }
  } catch (error) {
    throw new AssistantRuntimeError(getErrorMessage(error), {
      responseId,
      toolCalls
    });
  }

  throw new AssistantRuntimeError(
    "O assistente excedeu o limite de consultas para esta mensagem.",
    { responseId, toolCalls }
  );
}

function toOpenAITool(tool: ToolDefinition): FunctionTool {
  return {
    description: tool.description,
    name: tool.name,
    parameters: tool.schema,
    strict: true,
    type: "function"
  };
}

function getToolChoice(
  role: UserRole,
  requestedTool: ToolName | undefined
): ToolChoiceFunction | ToolChoiceOptions {
  if (requestedTool && isToolAllowedForRole(role, requestedTool)) {
    return {
      name: requestedTool,
      type: "function"
    };
  }

  return "auto";
}

async function executeOpenAIToolCall({
  profile,
  supabase,
  toolCall,
  toolCalls
}: {
  profile: Profile;
  supabase: SupabaseServerClient;
  toolCall: ResponseFunctionToolCall;
  toolCalls: AssistantToolCallAudit[];
}): Promise<ResponseInputItem.FunctionCallOutput> {
  const startedAt = Date.now();
  const parsedInput = parseToolArguments(toolCall.arguments);

  if (!isToolName(toolCall.name)) {
    const output = {
      error: "Ferramenta não registrada no backend."
    };

    toolCalls.push({
      duration_ms: Date.now() - startedAt,
      error: output.error,
      input: parsedInput,
      output,
      status: "error",
      tool_name: toolCall.name
    });

    return toFunctionCallOutput(toolCall.call_id, output);
  }

  try {
    const execution = await executeTool(
      { profile, supabase },
      toolCall.name,
      parsedInput
    );

    toolCalls.push({
      duration_ms: Date.now() - startedAt,
      error: null,
      input: execution.input,
      output: execution.output,
      status: "success",
      tool_name: execution.tool.name
    });

    return toFunctionCallOutput(toolCall.call_id, execution.output);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const output = {
      error: errorMessage
    };

    toolCalls.push({
      duration_ms: Date.now() - startedAt,
      error: errorMessage,
      input: parsedInput,
      output,
      status: "error",
      tool_name: toolCall.name
    });

    return toFunctionCallOutput(toolCall.call_id, output);
  }
}

function toFunctionCallOutput(
  callId: string,
  output: JsonValue
): ResponseInputItem.FunctionCallOutput {
  return {
    call_id: callId,
    output: JSON.stringify(output),
    type: "function_call_output"
  };
}

function getFunctionCalls(response: Response) {
  return response.output.filter(
    (item): item is ResponseFunctionToolCall => item.type === "function_call"
  );
}

function getAssistantText(response: Response) {
  return (
    response.output_text?.trim() ||
    "Concluí a consulta, mas não consegui gerar uma resposta textual."
  );
}

function parseToolArguments(argumentsJson: string): Record<string, JsonValue> {
  try {
    const parsed = JSON.parse(argumentsJson) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, JsonValue>;
  } catch {
    return {};
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function getSystemInstructions(role: UserRole) {
  const shared = [
    "Você é o assistente AI da AROLAB.",
    "Responda naturalmente em português por padrão. Se a mensagem do usuário estiver em inglês, responda em inglês.",
    "Use apenas as ferramentas fornecidas nesta requisição. Não invente nomes de ferramentas.",
    "As ferramentas são somente leitura. Nunca prometa ou execute alterações, cadastros, uploads, contratos, ações financeiras ou SQL.",
    "Não revele dados privados que não tenham vindo de uma ferramenta permitida para o perfil autenticado.",
    "Quando não tiver permissão para acessar algo, explique de forma breve que esse perfil não tem acesso."
  ];

  const byRole = {
    admin:
      "Perfil admin: ajude com consultas internas read-only de modelos, perfis de modelos, clientes e contatos de clientes.",
    client:
      "Perfil cliente: ajude somente com busca pública de modelos aprovados e recomendações a partir de briefs. Não exponha dados internos, CRM ou informações privadas de modelos.",
    model:
      "Perfil modelo: ajude somente com o próprio perfil autenticado e orientações de casting. Não acesse outros modelos nem CRM de clientes."
  } satisfies Record<UserRole, string>;

  return [...shared, byRole[role]].join("\n");
}
