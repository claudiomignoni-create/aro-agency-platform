import { NextResponse } from "next/server";
import {
  AssistantRuntimeError,
  runOpenAIAssistant,
  type AssistantToolCallAudit
} from "@/lib/ai/openai-runtime";
import {
  getToolDefinitionsForRole,
  isToolName
} from "@/lib/ai/tools";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const runtime = "nodejs";

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

  const profileRecord = profile as Profile;
  const requestedTool = isToolName(body.toolName) ? body.toolName : undefined;
  const apiKey = process.env.OPENAI_API_KEY;
  let assistantMessage =
    "Não consegui acionar o assistente AI agora. Tente novamente em instantes.";
  let responseStatus = 200;
  let responseId: string | null = null;
  let toolCalls: AssistantToolCallAudit[] = [];

  if (!apiKey) {
    assistantMessage =
      "O assistente AI ainda não está configurado no servidor. Defina OPENAI_API_KEY para habilitar esta função.";
    responseStatus = 500;
  } else {
    try {
      const assistantResult = await runOpenAIAssistant({
        apiKey,
        message,
        profile: profileRecord,
        requestedTool,
        supabase
      });

      assistantMessage = assistantResult.message;
      responseId = assistantResult.responseId;
      toolCalls = assistantResult.toolCalls;
    } catch (error) {
      responseStatus = 500;
      console.error("AI assistant runtime error", error);

      if (error instanceof AssistantRuntimeError) {
        responseId = error.responseId;
        toolCalls = error.toolCalls;
      }

      assistantMessage = getAssistantErrorMessage(error);
    }
  }

  const auditResult = await writeAuditLog({
    assistantMessage,
    metadata: {
      openai_response_id: responseId,
      requested_tool: requestedTool ?? null,
      runtime: "openai_responses",
      version: 2
    },
    profile: profileRecord,
    supabase,
    toolCalls,
    userMessage: message
  });

  if (auditResult.error) {
    return NextResponse.json({ error: auditResult.error }, { status: 500 });
  }

  return NextResponse.json({
    conversationId: auditResult.conversationId,
    message: assistantMessage,
    role: profile.role,
    toolCall: toolCalls[0] ?? null,
    toolCalls,
    tools: getToolDefinitionsForRole(profile.role)
  }, { status: responseStatus });
}

async function writeAuditLog({
  assistantMessage,
  metadata,
  profile,
  supabase,
  toolCalls,
  userMessage
}: {
  assistantMessage: string;
  metadata: Record<string, unknown>;
  profile: Profile;
  supabase: Awaited<ReturnType<typeof createClient>>;
  toolCalls: AssistantToolCallAudit[];
  userMessage: string;
}) {
  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .insert({
      actor_id: profile.id,
      actor_role: profile.role,
      assistant_message: assistantMessage,
      metadata,
      user_message: userMessage
    })
    .select("id")
    .single();

  if (conversationError) {
    return { error: conversationError.message };
  }

  if (toolCalls.length === 0) {
    return { conversationId: conversation.id as string, error: null };
  }

  const { error: toolCallError } = await supabase.from("ai_tool_calls").insert(
    toolCalls.map((toolCall) => ({
      actor_id: profile.id,
      conversation_id: conversation.id,
      duration_ms: toolCall.duration_ms,
      error: toolCall.error,
      input: toolCall.input,
      output: toolCall.output,
      status: toolCall.status,
      tool_name: toolCall.tool_name
    }))
  );

  if (toolCallError) {
    return { error: toolCallError.message };
  }

  return { conversationId: conversation.id as string, error: null };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function getAssistantErrorMessage(error: unknown) {
  const message = getErrorMessage(error);

  if (/invalid schema|schema|tool|function/i.test(message)) {
    return "Não consegui iniciar o assistente AI por uma configuração de ferramentas. O detalhe foi registrado no servidor.";
  }

  return `Não consegui concluir a consulta com o assistente AI. ${message}`;
}
