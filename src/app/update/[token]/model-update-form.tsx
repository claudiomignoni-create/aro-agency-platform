"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { PublicModelUpdateRequestPayload } from "@/lib/communications/data";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";

type ModelUpdateFormProps = {
  request: PublicModelUpdateRequestPayload;
  token: string;
};

const fieldDefinitions: Record<
  string,
  { group: string; label: string; placeholder?: string; sensitive?: boolean; type?: "file" | "number" | "textarea" | "text" }
> = {
  bust_cm: { group: "Medidas", label: "Busto em cm", type: "number" },
  contact: { group: "Contato", label: "E-mail ou WhatsApp atualizado" },
  dress_size_br: { group: "Medidas", label: "Manequim BR" },
  documents: { group: "Documentos", label: "Documentos", sensitive: true, type: "file" },
  health: { group: "Saúde", label: "Informações de saúde", sensitive: true, type: "textarea" },
  height_cm: { group: "Medidas", label: "Altura em cm", type: "number" },
  hips_cm: { group: "Medidas", label: "Quadril em cm", type: "number" },
  instagram: { group: "Redes sociais", label: "Instagram", placeholder: "@aro" },
  location: { group: "Localização", label: "Cidade e país base" },
  measurements: { group: "Medidas", label: "Altura, busto, cintura, quadril e sapato", type: "textarea" },
  passport: { group: "Documentos", label: "Passaporte", sensitive: true },
  polaroids: { group: "Polaroids", label: "Polaroids recentes", type: "file" },
  portfolio: { group: "Portfolio", label: "Portfolio atualizado", type: "file" },
  shoe_size_br: { group: "Medidas", label: "Sapato BR" },
  videos: { group: "Vídeos", label: "Vídeos recentes", type: "file" },
  waist_cm: { group: "Medidas", label: "Cintura em cm", type: "number" },
  visa: { group: "Documentos", label: "Visto", sensitive: true },
  banking: { group: "Dados bancários", label: "Dados bancários", sensitive: true, type: "textarea" }
};

const structuredMeasurementFields = ["height_cm", "bust_cm", "waist_cm", "hips_cm", "shoe_size_br", "dress_size_br"];

function expandRequestedFields(fields: PublicModelUpdateRequestPayload["fields"]) {
  return fields.flatMap((field) =>
    field.field_key === "measurements"
      ? structuredMeasurementFields.map((fieldKey) => ({
          ...field,
          field_group: "measurements",
          field_key: fieldKey
        }))
      : [field]
  );
}

function stringifyDraftValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function fileSha256(file: File) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function ModelUpdateForm({ request, token }: ModelUpdateFormProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.draft_payload ?? {})) {
      values[key] = stringifyDraftValue(value);
    }
    return values;
  });
  const [fileStatus, setFileStatus] = useState<Record<string, string>>({});
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "pending" | "sent" | "verified" | "error">("idle");
  const [status, setStatus] = useState<"dirty" | "error" | "saved" | "saving" | "submitted">("saved");
  const [isPending, startTransition] = useTransition();
  const requestedFields = useMemo(
    () =>
      request.fields.length
        ? expandRequestedFields(request.fields)
        : [
            { field_group: "measurements", field_key: "height_cm", is_required: true, is_sensitive: false },
            { field_group: "measurements", field_key: "bust_cm", is_required: true, is_sensitive: false },
            { field_group: "measurements", field_key: "waist_cm", is_required: true, is_sensitive: false },
            { field_group: "measurements", field_key: "hips_cm", is_required: true, is_sensitive: false },
            { field_group: "profile", field_key: "location", is_required: false, is_sensitive: false }
          ],
    [request.fields]
  );
  const editableFields = useMemo(() => requestedFields.filter((field) => !field.is_sensitive), [requestedFields]);
  const completedCount = editableFields.filter((field) => draft[field.field_key]?.trim()).length;
  const progress = editableFields.length ? Math.round((completedCount / editableFields.length) * 100) : 100;
  const autosaveDraft = useMemo(
    () =>
      Object.fromEntries(
        editableFields
          .map((field) => [field.field_key, draft[field.field_key]] as const)
          .filter(([, value]) => value?.trim())
      ),
    [draft, editableFields]
  );

  useEffect(() => {
    if (status !== "dirty") return;
    const timer = window.setTimeout(async () => {
      setStatus("saving");
      const response = await fetch(`/update/${token}/autosave`, {
        body: JSON.stringify({ draft: autosaveDraft }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      setStatus(response.ok ? "saved" : "error");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [autosaveDraft, status, token]);

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

  async function uploadFiles(fieldKey: string, files: FileList | null) {
    if (!files?.length) return;
    const supabase = createBrowserSupabaseClient();

    for (const file of Array.from(files)) {
      const key = `${fieldKey}:${file.name}`;
      setFileStatus((current) => ({ ...current, [key]: "Preparando..." }));
      const checksum = await fileSha256(file);
      const prepare = await fetch(`/update/${token}/uploads`, {
        body: JSON.stringify({
          action: "prepare",
          fieldKey,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sha256: checksum,
          sizeBytes: file.size
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const prepared = (await prepare.json()) as {
        bucket?: string;
        error?: string;
        objectPath?: string;
        ok: boolean;
        token?: string;
      };

      if (!prepared.ok || !prepared.bucket || !prepared.objectPath || !prepared.token) {
        setFileStatus((current) => ({ ...current, [key]: prepared.error ?? "Falha ao preparar" }));
        continue;
      }

      setFileStatus((current) => ({ ...current, [key]: "Enviando..." }));
      const { error } = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.objectPath, prepared.token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false
        });

      if (error) {
        setFileStatus((current) => ({ ...current, [key]: error.message }));
        continue;
      }

      const complete = await fetch(`/update/${token}/uploads`, {
        body: JSON.stringify({
          action: "complete",
          bucket: prepared.bucket,
          fieldKey,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          objectPath: prepared.objectPath,
          sha256: checksum,
          sizeBytes: file.size
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const completed = (await complete.json()) as { error?: string; ok: boolean };
      setFileStatus((current) => ({
        ...current,
        [key]: completed.ok ? "Enviado para revisão" : completed.error ?? "Falha ao registrar"
      }));
    }
  }

  async function requestVerificationCode() {
    setVerificationStatus("pending");
    const response = await fetch(`/update/${token}/verification-code`, {
      body: JSON.stringify({ mode: "request" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    setVerificationStatus(response.ok ? "sent" : "error");
  }

  async function verifyCode() {
    setVerificationStatus("pending");
    const response = await fetch(`/update/${token}/verification-code`, {
      body: JSON.stringify({ code: verificationCode, mode: "verify" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    setVerificationStatus(response.ok ? "verified" : "error");
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
            const canEditSensitive = sensitive && verificationStatus === "verified";

            return (
              <label className={sensitive ? "sensitive" : ""} key={field.field_key}>
                <span>
                  {definition.label}
                  {field.is_required ? <strong>Obrigatório</strong> : null}
                  {sensitive ? <strong>Verificação necessária</strong> : null}
                </span>
                {sensitive && !canEditSensitive ? (
                  <div className="model-update-verification">
                    <p>Este campo exige código de verificação enviado para o e-mail cadastrado.</p>
                    <button onClick={requestVerificationCode} type="button">Enviar código</button>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      placeholder="000000"
                      value={verificationCode}
                    />
                    <button onClick={verifyCode} type="button">Validar código</button>
                    <small>{verificationStatus}</small>
                  </div>
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
                  <>
                    <input
                      accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime"
                      onChange={(event) => uploadFiles(field.field_key, event.target.files)}
                      type="file"
                      multiple
                    />
                    <div className="model-update-file-status">
                      {Object.entries(fileStatus)
                        .filter(([key]) => key.startsWith(`${field.field_key}:`))
                        .map(([key, value]) => (
                          <small key={key}>{key.split(":").slice(1).join(":")}: {value}</small>
                        ))}
                    </div>
                  </>
                ) : (
                  <input
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [field.field_key]: event.target.value }));
                      setStatus("dirty");
                    }}
                    placeholder={definition.placeholder}
                    type={definition.type === "number" ? "number" : "text"}
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
