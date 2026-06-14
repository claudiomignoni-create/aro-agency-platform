"use client";

import { FormEvent, useMemo, useState } from "react";
import type { UserRole } from "@/types/database";

type ToolName =
  | "get_casting_guidelines"
  | "get_client_contacts"
  | "get_model_profile"
  | "get_my_profile"
  | "recommend_models_for_brief"
  | "search_clients"
  | "search_models"
  | "search_public_models";

type AssistantMessage = {
  content: string;
  data?: unknown;
  id: string;
  role: "assistant" | "user";
  toolName?: string;
};

type AssistantResponse = {
  error?: string;
  message?: string;
  toolCall?: {
    output: unknown;
    status: "error" | "success";
    tool_name: string;
  };
};

type ToolOption = {
  helper: string;
  label: string;
  name: ToolName;
};

type AIAssistantPanelProps = {
  role: UserRole;
};

const toolOptionsByRole = {
  admin: [
    {
      helper: "Modelos internos",
      label: "Buscar modelos",
      name: "search_models"
    },
    {
      helper: "UUID do modelo",
      label: "Perfil do modelo",
      name: "get_model_profile"
    },
    {
      helper: "CRM",
      label: "Buscar clientes",
      name: "search_clients"
    },
    {
      helper: "UUID do cliente",
      label: "Contatos",
      name: "get_client_contacts"
    }
  ],
  model: [
    {
      helper: "Meu Cadastro360",
      label: "Meu perfil",
      name: "get_my_profile"
    },
    {
      helper: "Preparação",
      label: "Casting",
      name: "get_casting_guidelines"
    }
  ],
  client: [
    {
      helper: "Aprovados",
      label: "Buscar modelos",
      name: "search_public_models"
    },
    {
      helper: "Brief",
      label: "Recomendar",
      name: "recommend_models_for_brief"
    }
  ]
} as const satisfies Record<UserRole, readonly ToolOption[]>;

const placeholderByRole = {
  admin: "Ex.: modelos aprovados em Sao Paulo ou UUID para detalhes",
  client: "Ex.: campanha beauty em Sao Paulo com perfil comercial",
  model: "Ex.: revisar meu perfil ou orientacoes para casting"
} satisfies Record<UserRole, string>;

export function AIAssistantPanel({ role }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      content:
        "Assistente pronto para consultas read-only. Escolha uma ferramenta ou descreva a busca.",
      id: "initial",
      role: "assistant"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolName | null>(null);
  const toolOptions = useMemo(() => toolOptionsByRole[role], [role]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message || isLoading) {
      return;
    }

    const userMessage: AssistantMessage = {
      content: message,
      id: crypto.randomUUID(),
      role: "user",
      toolName: selectedTool ?? undefined
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/assistant", {
        body: JSON.stringify({
          message,
          toolName: selectedTool
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as AssistantResponse;

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content:
            payload.message ??
            payload.error ??
            "O assistente não retornou uma resposta.",
          data: payload.toolCall?.output,
          id: crypto.randomUUID(),
          role: "assistant",
          toolName: payload.toolCall?.tool_name
        }
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content: "Não foi possível falar com o assistente agora.",
          id: crypto.randomUUID(),
          role: "assistant"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel ai-assistant-panel" aria-label="Assistente AI">
      <div className="ai-assistant-heading">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h2>Consultas assistidas</h2>
        </div>
        <span className="badge">Read-only</span>
      </div>

      <div className="ai-tool-list" aria-label="Ferramentas disponíveis">
        {toolOptions.map((tool) => (
          <button
            aria-pressed={selectedTool === tool.name}
            className={
              selectedTool === tool.name
                ? "ai-tool-chip active"
                : "ai-tool-chip"
            }
            key={tool.name}
            onClick={() =>
              setSelectedTool((currentTool) =>
                currentTool === tool.name ? null : tool.name
              )
            }
            type="button"
          >
            <strong>{tool.label}</strong>
            <span>{tool.helper}</span>
          </button>
        ))}
      </div>

      <div className="ai-message-list" aria-live="polite">
        {messages.map((message) => (
          <article className={`ai-message ${message.role}`} key={message.id}>
            {message.toolName ? (
              <span className="ai-message-tool">{message.toolName}</span>
            ) : null}
            <p>{message.content}</p>
            {message.data ? (
              <details className="ai-result-details">
                <summary>Dados consultados</summary>
                <pre>{JSON.stringify(message.data, null, 2)}</pre>
              </details>
            ) : null}
          </article>
        ))}
      </div>

      <form className="ai-assistant-form" onSubmit={handleSubmit}>
        <label>
          Mensagem
          <textarea
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholderByRole[role]}
            rows={3}
            value={input}
          />
        </label>
        <div className="actions spread">
          <span className="ai-selected-tool">
            {selectedTool ? selectedTool : "Seleção automática"}
          </span>
          <button className="button" disabled={isLoading} type="submit">
            {isLoading ? "Consultando" : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}
