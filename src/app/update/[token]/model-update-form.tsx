"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { PublicModelUpdateRequestPayload } from "@/lib/communications/data";

type ModelUpdateFormProps = {
  request: PublicModelUpdateRequestPayload;
  token: string;
};

const fieldDefinitions: Record<
  string,
  { group: string; label: string; placeholder?: string; sensitive?: boolean; type?: "file" | "textarea" | "text" }
> = {
  contact: { group: "Contato", label: "E-mail ou WhatsApp atualizado" },
  documents: { group: "Documentos", label: "Documentos", sensitive: true, type: "file" },
  health: { group: "Saúde", label: "Informações de saúde", sensitive: true, type: "textarea" },
  instagram: { group: "Redes sociais", label: "Instagram", placeholder: "@aro" },
  location: { group: "Localização", label: "Cidade e país base" },
  measurements: { group: "Medidas", label: "Altura, busto, cintura, quadril e sapato", type: "textarea" },
  passport: { group: "Documentos", label: "Passaporte", sensitive: true },
  polaroids: { group: "Polaroids", label: "Polaroids recentes", type: "file" },
  portfolio: { group: "Portfolio", label: "Portfolio atualizado", type: "file" },
  videos: { group: "Vídeos", label: "Vídeos recentes", type: "file" },
  visa: { group: "Documentos", label: "Visto", sensitive: true },
  banking: { group: "Dados bancários", label: "Dados bancários", sensitive: true, type: "textarea" }
};

function stringifyDraftValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function ModelUpdateForm({ request, token }: ModelUpdateFormProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.draft_payload ?? {})) {
      values[key] = stringifyDraftValue(value);
    }
    return values;
  });
  const [status, setStatus] = useState<"dirty" | "error" | "saved" | "saving" | "submitted">("saved");
  const [isPending, startTransition] = useTransition();
  const requestedFields = useMemo(
    () =>
      request.fields.length
        ? request.fields
        : [
            { field_group: "profile", field_key: "measurements", is_required: true, is_sensitive: false },
            { field_group: "profile", field_key: "location", is_required: false, is_sensitive: false }
          ],
    [request.fields]
  );
  const editableFields = requestedFields.filter((field) => !field.is_sensitive);
  const completedCount = editableFields.filter((field) => draft[field.field_key]?.trim()).length;
  const progress = editableFields.length ? Math.round((completedCount / editableFields.length) * 100) : 100;

  useEffect(() => {
    if (status !== "dirty") return;
    const timer = window.setTimeout(async () => {
      setStatus("saving");
      const response = await fetch(`/update/${token}/autosave`, {
        body: JSON.stringify({ draft }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      setStatus(response.ok ? "saved" : "error");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, status, token]);

  const groupedFields = useMemo(() => {
    const groups = new Map<string, typeof requestedFields>();
    for (const field of requestedFields) {
      const definition = fieldDefinitions[field.field_key];
      const group = definition?.group ?? field.field_group;
      groups.set(group, [...(groups.get(group) ?? []), field]);
    }
    return Array.from(groups.entries());
  }, [requestedFields]);

  async function submit() {
    setStatus("saving");
    const response = await fetch(`/update/${token}/submit`, {
      body: JSON.stringify({ submission: draft }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    setStatus(response.ok ? "submitted" : "error");
  }

  return (
    <div className="model-update-form">
      <div className="model-update-progress" aria-label={`Progresso ${progress}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="model-update-status">
        {status === "saving" || isPending ? "Salvando..." : null}
        {status === "saved" ? "Rascunho salvo" : null}
        {status === "dirty" ? "Alterações pendentes" : null}
        {status === "error" ? "Não foi possível salvar agora" : null}
        {status === "submitted" ? "Enviado para revisão da ARO" : null}
      </p>

      {groupedFields.map(([group, fields]) => (
        <section key={group}>
          <h2>{group}</h2>
          {fields.map((field) => {
            const definition = fieldDefinitions[field.field_key] ?? {
              group,
              label: field.field_key
            };
            const sensitive = field.is_sensitive || definition.sensitive;

            return (
              <label className={sensitive ? "sensitive" : ""} key={field.field_key}>
                <span>
                  {definition.label}
                  {field.is_required ? <strong>Obrigatório</strong> : null}
                  {sensitive ? <strong>Verificação necessária</strong> : null}
                </span>
                {sensitive ? (
                  <p>
                    Este campo não é enviado sem verificação adicional por e-mail. A ARO ativará essa etapa antes de
                    solicitar documentos, saúde ou banco.
                  </p>
                ) : definition.type === "textarea" ? (
                  <textarea
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [field.field_key]: event.target.value }));
                      setStatus("dirty");
                    }}
                    placeholder={definition.placeholder}
                    rows={4}
                    value={draft[field.field_key] ?? ""}
                  />
                ) : definition.type === "file" ? (
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime"
                    onChange={(event) => {
                      const names = Array.from(event.target.files ?? []).map((file) => file.name).join(", ");
                      setDraft((current) => ({ ...current, [field.field_key]: names }));
                      setStatus("dirty");
                    }}
                    type="file"
                    multiple
                  />
                ) : (
                  <input
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [field.field_key]: event.target.value }));
                      setStatus("dirty");
                    }}
                    placeholder={definition.placeholder}
                    value={draft[field.field_key] ?? ""}
                  />
                )}
              </label>
            );
          })}
        </section>
      ))}

      <section>
        <h2>Revisão</h2>
        <dl>
          {editableFields.map((field) => (
            <div key={field.field_key}>
              <dt>{fieldDefinitions[field.field_key]?.label ?? field.field_key}</dt>
              <dd>{draft[field.field_key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <button
        className="model-update-submit"
        disabled={status === "submitted" || isPending}
        onClick={() => startTransition(submit)}
        type="button"
      >
        Enviar para revisão
      </button>
    </div>
  );
}
