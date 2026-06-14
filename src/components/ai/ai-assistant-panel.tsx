"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { UserRole } from "@/types/database";

type AssistantMessage = {
  content: string;
  data?: unknown;
  id: string;
  isError?: boolean;
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

type AIAssistantPanelProps = {
  role: UserRole;
};

const roleCopy = {
  admin: {
    eyebrow: "Internal AI Assistant",
    intro:
      "Consulte modelos, clientes e contatos com as ferramentas internas read-only permitidas para admin.",
    placeholder: "Peça uma busca interna, um resumo ou uma explicação de acesso",
    title: "Assistente AROLAB"
  },
  client: {
    eyebrow: "Client AI Assistant",
    intro:
      "Encontre modelos publicados e refine ideias de campanha usando apenas dados públicos disponíveis para clientes.",
    placeholder: "Descreva a campanha, cidade, perfil ou estilo desejado",
    title: "Assistente de casting"
  },
  model: {
    eyebrow: "Model AI Assistant",
    intro:
      "Revise orientações de casting e consulte somente as informações do seu próprio perfil autenticado.",
    placeholder: "Pergunte sobre casting, perfil ou preparação",
    title: "Assistente do modelo"
  }
} satisfies Record<
  UserRole,
  {
    eyebrow: string;
    intro: string;
    placeholder: string;
    title: string;
  }
>;

const suggestedPrompts = {
  admin: [
    "Busque modelos aprovados em Sao Paulo",
    "Procure clientes ativos",
    "Explique quais ferramentas voce pode usar"
  ],
  client: [
    "Recomende modelos para uma campanha beauty em Sao Paulo",
    "Busque modelos comerciais",
    "Voce consegue ver dados privados dos modelos?"
  ],
  model: [
    "Quais orientacoes para casting?",
    "Mostre meu perfil",
    "Voce consegue ver outros modelos?"
  ]
} satisfies Record<UserRole, string[]>;

export function AIAssistantPanel({ role }: AIAssistantPanelProps) {
  const copy = roleCopy[role];
  const prompts = useMemo(() => suggestedPrompts[role], [role]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage(input);
  }

  async function handlePromptClick(prompt: string) {
    await submitMessage(prompt);
  }

  async function submitMessage(rawMessage: string) {
    const message = rawMessage.trim();

    if (!message || isLoading) {
      return;
    }

    const userMessage: AssistantMessage = {
      content: message,
      id: crypto.randomUUID(),
      role: "user"
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/assistant", {
        body: JSON.stringify({ message }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as AssistantResponse;
      const isError = !response.ok || Boolean(payload.error);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content:
            payload.message ??
            payload.error ??
            "O assistente nao retornou uma resposta.",
          data: payload.toolCall?.output,
          id: crypto.randomUUID(),
          isError,
          role: "assistant",
          toolName: payload.toolCall?.tool_name
        }
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content: "Nao foi possivel falar com o assistente agora.",
          id: crypto.randomUUID(),
          isError: true,
          role: "assistant"
        }
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <section className="assistant-page" aria-label="Assistente AI">
      <div className="assistant-shell">
        <header className="assistant-header">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h2>{copy.title}</h2>
            <p>{copy.intro}</p>
          </div>
          <span className="assistant-status">Read-only</span>
        </header>

        <div className="assistant-thread" aria-live="polite">
          {messages.length === 0 ? (
            <div className="assistant-empty-state">
              <span className="assistant-empty-mark">AI</span>
              <h3>Como posso ajudar agora?</h3>
              <p>
                Use linguagem natural. O backend decide quais ferramentas estao
                disponiveis para o seu perfil.
              </p>
              <div className="assistant-suggestions" aria-label="Sugestoes">
                {prompts.map((prompt) => (
                  <button
                    disabled={isLoading}
                    key={prompt}
                    onClick={() => void handlePromptClick(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <AssistantMessageBubble key={message.id} message={message} />
            ))
          )}

          {isLoading ? (
            <article className="assistant-message assistant">
              <span className="assistant-thinking" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <p>Consultando o assistente...</p>
            </article>
          ) : null}
        </div>

        <form className="assistant-composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="assistant-message">
            Mensagem para o assistente
          </label>
          <textarea
            id="assistant-message"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={copy.placeholder}
            ref={textareaRef}
            rows={3}
            value={input}
          />
          <div className="assistant-composer-footer">
            <span>Somente leitura. Sem contratos, financeiro ou acoes de escrita.</span>
            <button className="button" disabled={isLoading || !input.trim()} type="submit">
              {isLoading ? "Enviando" : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function AssistantMessageBubble({ message }: { message: AssistantMessage }) {
  const summary = summarizeToolOutput(message.data);

  return (
    <article
      className={[
        "assistant-message",
        message.role,
        message.isError ? "error" : ""
      ].join(" ")}
    >
      {message.toolName ? (
        <span className="assistant-tool-name">{message.toolName}</span>
      ) : null}
      <p>{message.content}</p>
      {summary.length > 0 ? (
        <div className="assistant-data-preview">
          {summary.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {message.data ? (
        <details className="assistant-result-details">
          <summary>Ver dados estruturados</summary>
          <pre>{JSON.stringify(message.data, null, 2)}</pre>
        </details>
      ) : null}
    </article>
  );
}

function summarizeToolOutput(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const record = data as Record<string, unknown>;

  if (Array.isArray(record.models)) {
    return [
      `${record.models.length} modelo${record.models.length === 1 ? "" : "s"}`,
      ...record.models.slice(0, 3).map(getDisplayName).filter(Boolean)
    ];
  }

  if (Array.isArray(record.clients)) {
    return [
      `${record.clients.length} cliente${record.clients.length === 1 ? "" : "s"}`,
      ...record.clients.slice(0, 3).map(getCompanyName).filter(Boolean)
    ];
  }

  if (Array.isArray(record.recommendations)) {
    return [
      `${record.recommendations.length} recomendacao${
        record.recommendations.length === 1 ? "" : "es"
      }`,
      ...record.recommendations.slice(0, 3).map(getRecommendationName).filter(Boolean)
    ];
  }

  if (Array.isArray(record.contacts)) {
    return [
      `${record.contacts.length} contato${record.contacts.length === 1 ? "" : "s"}`,
      ...record.contacts.slice(0, 3).map(getContactName).filter(Boolean)
    ];
  }

  if (Array.isArray(record.guidelines)) {
    return [`${record.guidelines.length} orientacoes`];
  }

  if (record.model && typeof record.model === "object") {
    const name = getDisplayName(record.model);
    return name ? [name] : ["Perfil encontrado"];
  }

  return [];
}

function getDisplayName(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  return stringValue(record.stage_name) || stringValue(record.display_name);
}

function getCompanyName(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return stringValue((value as Record<string, unknown>).company_name);
}

function getContactName(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return stringValue((value as Record<string, unknown>).contact_name);
}

function getRecommendationName(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const model = (value as Record<string, unknown>).model;
  return getDisplayName(model);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
