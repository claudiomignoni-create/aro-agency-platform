import { notFound } from "next/navigation";
import Link from "next/link";
import { getModel } from "@/lib/models";
import { ModelForm } from "../../model-form";
import {
  archiveModelAction,
  deleteModelAction,
  updateModelAction,
  updateModelStatusAction
} from "../../actions";

type EditModelPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditModelPage({ params }: EditModelPageProps) {
  const { id } = await params;
  const model = await getModel(id);

  if (!model) {
    notFound();
  }

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Editar modelo</span>
        <h2>{model.display_name}</h2>
        <p>Edite os dados principais, publicação e status do modelo.</p>
        <div className="actions">
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
      <section className="panel">
        <ModelForm
          action={updateModelAction.bind(null, model.id)}
          model={model}
          submitLabel="Salvar alterações"
        />
      </section>
      <Link className="button secondary" href="/admin/models">
        Voltar para modelos
      </Link>
    </div>
  );
}
