import Link from "next/link";
import { ModelForm } from "../model-form";
import { createModelAction } from "../actions";

export default function NewModelPage() {
  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Novo modelo</span>
        <h2>Criar modelo</h2>
        <p>Cadastre o perfil base. Fotos e vídeos entram pela área de mídia.</p>
      </section>
      <section className="panel">
        <ModelForm action={createModelAction} submitLabel="Criar modelo" />
      </section>
      <Link className="button secondary" href="/admin/models">
        Voltar para modelos
      </Link>
    </div>
  );
}
