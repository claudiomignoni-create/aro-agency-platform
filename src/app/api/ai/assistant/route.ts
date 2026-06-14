import { NextResponse } from "next/server";
import {
  chooseToolForMessage,
  executeTool,
  getToolDefinitionsForRole,
  inputFromMessage,
  isToolName,
  type JsonValue,
  type ToolName
} from "@/lib/ai/tools";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

type AssistantRequestBody = {
  message?: unknown;
  toolName?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  let body: AssistantRequestBody;

  try {
    body = (await request.json()) as AssistantRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 1200) : "";

  if (!message) {
    return NextResponse.json(
      { error: "Envie uma mensagem para o assistente." },
      { status: 400 }
    );
  }

  const requestedTool = isToolName(body.toolName) ? body.toolName : undefined;
  const selectedTool = chooseToolForMessage(
    profile.role,
    message,
    requestedTool
  );
  const startedAt = Date.now();

  let assistantMessage = "";
  let toolCall:
    | {
        duration_ms: number;
        error: string | null;
        input: Record<string, JsonValue>;
        output: JsonValue | null;
        status: "error" | "success";
        tool_name: ToolName;
      }
    | null = null;

  try {
    const toolInput = inputFromMessage(selectedTool, message);
    const execution = await executeTool(
      { profile: profile as Profile, supabase },
      selectedTool,
      toolInput
    );
    const summary = summarizeToolOutput(selectedTool, execution.output);

    assistantMessage = summary.message;
    toolCall = {
      duration_ms: Date.now() - startedAt,
      error: null,
      input: execution.input,
      output: execution.output,
      status: "success",
      tool_name: selectedTool
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Falha ao executar ferramenta.";

    assistantMessage = buildToolErrorMessage(selectedTool, errorMessage);
    toolCall = {
      duration_ms: Date.now() - startedAt,
      error: errorMessage,
      input: inputFromMessage(selectedTool, message),
      output: null,
      status: "error",
      tool_name: selectedTool
    };
  }

  const auditResult = await writeAuditLog({
    assistantMessage,
    profile: profile as Profile,
    supabase,
    toolCall,
    userMessage: message
  });

  if (auditResult.error) {
    return NextResponse.json({ error: auditResult.error }, { status: 500 });
  }

  return NextResponse.json({
    conversationId: auditResult.conversationId,
    message: assistantMessage,
    role: profile.role,
    toolCall,
    tools: getToolDefinitionsForRole(profile.role)
  });
}

async function writeAuditLog({
  assistantMessage,
  profile,
  supabase,
  toolCall,
  userMessage
}: {
  assistantMessage: string;
  profile: Profile;
  supabase: Awaited<ReturnType<typeof createClient>>;
  toolCall: {
    duration_ms: number;
    error: string | null;
    input: Record<string, JsonValue>;
    output: JsonValue | null;
    status: "error" | "success";
    tool_name: ToolName;
  } | null;
  userMessage: string;
}) {
  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .insert({
      actor_id: profile.id,
      actor_role: profile.role,
      assistant_message: assistantMessage,
      metadata: { version: 1 },
      user_message: userMessage
    })
    .select("id")
    .single();

  if (conversationError) {
    return { error: conversationError.message };
  }

  if (!toolCall) {
    return { conversationId: conversation.id as string, error: null };
  }

  const { error: toolCallError } = await supabase.from("ai_tool_calls").insert({
    actor_id: profile.id,
    conversation_id: conversation.id,
    duration_ms: toolCall.duration_ms,
    error: toolCall.error,
    input: toolCall.input,
    output: toolCall.output,
    status: toolCall.status,
    tool_name: toolCall.tool_name
  });

  if (toolCallError) {
    return { error: toolCallError.message };
  }

  return { conversationId: conversation.id as string, error: null };
}

function summarizeToolOutput(toolName: ToolName, output: JsonValue) {
  const count = getPrimaryCount(output);

  if (toolName === "get_casting_guidelines") {
    return { message: "Encontrei as orientações de casting atuais." };
  }

  if (toolName === "get_my_profile") {
    return { message: "Consultei o seu perfil de modelo." };
  }

  if (toolName === "get_client_contacts") {
    return { message: "Consultei os contatos e canais desse cliente." };
  }

  if (toolName === "get_model_profile") {
    return { message: "Consultei o perfil interno desse modelo." };
  }

  if (toolName === "recommend_models_for_brief") {
    return {
      message:
        count > 0
          ? `Encontrei ${count} recomendações públicas para esse brief.`
          : "Não encontrei recomendações claras para esse brief com os dados públicos atuais."
    };
  }

  return {
    message:
      count > 0
        ? `Encontrei ${count} resultado${count === 1 ? "" : "s"} para a busca.`
        : "Não encontrei resultados para essa busca."
  };
}

function buildToolErrorMessage(toolName: ToolName, errorMessage: string) {
  if (toolName === "get_client_contacts") {
    return `Não consegui consultar os contatos. Envie o UUID do cliente. Detalhe: ${errorMessage}`;
  }

  if (toolName === "get_model_profile") {
    return `Não consegui consultar o perfil. Envie o UUID do modelo. Detalhe: ${errorMessage}`;
  }

  return `Não consegui concluir a consulta. Detalhe: ${errorMessage}`;
}

function getPrimaryCount(output: JsonValue) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return 0;
  }

  const record = output as Record<string, JsonValue>;

  for (const key of ["models", "clients", "contacts", "recommendations"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return 0;
}
