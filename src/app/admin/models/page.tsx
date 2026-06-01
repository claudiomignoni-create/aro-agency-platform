import Link from "next/link";
import { listModels } from "@/lib/models";
import { updateModelStatusAction } from "./actions";

export default async function AdminModelsPage() {
  const models = await listModels();

  return (
    <div className="stack">
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Admin</span>
            <h2>Modelos</h2>
          </div>
          <Link className="button" href="/admin/models/new">
            Criar modelo
          </Link>
        </div>
      </section>

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Status</th>
              <th>Publicado</th>
              <th>Nacionalidade</th>
              <th>Local</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id}>
                <td>
                  <strong>{model.display_name}</strong>
                  <br />
                  <span className="muted">{model.email}</span>
                </td>
                <td>
                  <span className="status">{model.status}</span>
                </td>
                <td>{model.is_published ? "Sim" : "Não"}</td>
                <td>{model.nationality ?? "-"}</td>
                <td>{model.location ?? "-"}</td>
                <td>
                  <div className="actions">
                    <Link
                      className="button secondary"
                      href={`/admin/models/${model.id}/edit`}
                    >
                      Editar
                    </Link>
                    <form
                      action={updateModelStatusAction.bind(
                        null,
                        model.id,
                        "approved"
                      )}
                    >
                      <button className="button secondary" type="submit">
                        Aprovar
                      </button>
                    </form>
                    <form
                      action={updateModelStatusAction.bind(
                        null,
                        model.id,
                        "draft"
                      )}
                    >
                      <button className="button secondary" type="submit">
                        Draft
                      </button>
                    </form>
                    <form
                      action={updateModelStatusAction.bind(
                        null,
                        model.id,
                        "archived"
                      )}
                    >
                      <button className="button secondary" type="submit">
                        Arquivar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {models.length === 0 ? <p>Nenhum modelo cadastrado ainda.</p> : null}
      </section>
    </div>
  );
}
