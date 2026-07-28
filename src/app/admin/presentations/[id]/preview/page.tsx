import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PresentationPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: presentation, error } = await supabase
    .from("presentations")
    .select("title, description, status, snapshot")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  const snapshot = (presentation?.snapshot ?? {}) as {
    models?: Array<{
      city?: string | null;
      country?: string | null;
      display_name: string;
      highlighted?: boolean;
      measurements?: Record<string, string | number | null>;
      media?: unknown[];
    }>;
  };

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Prévia administrativa da versão publicada. Dados privados não entram no snapshot."
        eyebrow="Presentation"
        title={presentation?.title ?? "Preview"}
      />
      <AdminSection title="Preview seguro" meta={presentation?.status ?? "draft"}>
        {snapshot.models?.length ? (
          <div className="admin-public-preview-grid">
            {snapshot.models.map((model) => (
              <article className="admin-selection-card" key={model.display_name}>
                {model.highlighted ? <span className="admin-chip">Destaque</span> : null}
                <strong>{model.display_name}</strong>
                <small className="muted">
                  {[model.city, model.country].filter(Boolean).join(", ") || "Localização não exibida"}
                </small>
                <div className="admin-kv-grid compact">
                  {Object.entries(model.measurements ?? {}).map(([key, value]) => (
                    <span key={key}>{key.replace("_cm", "")}: <strong>{value ?? "—"}</strong></span>
                  ))}
                </div>
                <small className="muted">{model.media?.length ?? 0} material(is)</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Publique a apresentação para gerar o snapshot de preview.</p>
        )}
      </AdminSection>
    </AdminPage>
  );
}
