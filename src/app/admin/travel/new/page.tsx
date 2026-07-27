import { createTravelTripAction } from "@/app/admin/travel/actions";
import { TravelForm } from "@/app/admin/travel/travel-form";
import { getTravelSchemaStatus } from "@/lib/travel";
import { listModels } from "@/lib/models";

export default async function NewTravelPage() {
  const [schema, models] = await Promise.all([getTravelSchemaStatus(), listModels()]);

  return (
    <div className="stack">
      {!schema.ready ? (
        <section className="panel stack">
          <span className="eyebrow">Travel</span>
          <h2>Travel ainda não ativado no banco.</h2>
          <p>Aplique as migrations 016, 017 e 018 no ambiente correto antes de criar viagens.</p>
        </section>
      ) : (
        <TravelForm action={createTravelTripAction} models={models} submitLabel="Criar viagem" />
      )}
    </div>
  );
}
