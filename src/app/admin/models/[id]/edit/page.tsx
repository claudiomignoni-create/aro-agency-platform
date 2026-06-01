import { notFound } from "next/navigation";
import Link from "next/link";
import { getModelProfile } from "@/lib/models";
import {
  isModelMediaFilter,
  isModelProfileTab,
  ModelProfileEditor,
  type ModelMediaFilter,
  type ModelProfileTab
} from "../../model-form";
import {
  archiveModelAction,
  deleteModelAction,
  updateModelStatusAction
} from "../../actions";

type EditModelPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    mediaFilter?: string;
    saved?: string;
    tab?: string;
  }>;
};

export default async function EditModelPage({
  params,
  searchParams
}: EditModelPageProps) {
  const { id } = await params;
  const { mediaFilter, saved, tab } = (await searchParams) ?? {};
  const activeTab: ModelProfileTab =
    tab && isModelProfileTab(tab) ? tab : "basic";
  const activeMediaFilter: ModelMediaFilter =
    mediaFilter && isModelMediaFilter(mediaFilter) ? mediaFilter : "all";
  const profile = await getModelProfile(id);

  if (!profile) {
    notFound();
  }

  const model = profile.model;
  const modelName = model.stage_name ?? model.display_name;

  return (
    <div className="stack">
      {saved ? <p className="toast">Alteração salva com sucesso.</p> : null}
      <section className="panel">
        <span className="eyebrow">Editar modelo</span>
        <h2>{modelName}</h2>
        <p>Perfil profissional completo para uso administrativo e comercial.</p>
        <div className="actions">
          <Link className="button secondary" href="/admin/models">
            Voltar
          </Link>
          <form action={updateModelStatusAction.bind(null, model.id, "approved")}>
            <button className="button secondary" type="submit">
              Aprovar
            </button>
          </form>
          <form action={updateModelStatusAction.bind(null, model.id, "draft")}>
            <button className="button secondary" type="submit">
              Marcar draft
            </button>
          </form>
          <form action={archiveModelAction.bind(null, model.id)}>
            <button className="button secondary" type="submit">
              Arquivar
            </button>
          </form>
          <form action={deleteModelAction.bind(null, model.id)}>
            <button className="button danger" type="submit">
              Excluir
            </button>
          </form>
        </div>
      </section>
      <ModelProfileEditor
        activeTab={activeTab}
        mediaFilter={activeMediaFilter}
        profile={profile}
      />
      <Link className="button secondary" href="/admin/models">
        Voltar para modelos
      </Link>
    </div>
  );
}
