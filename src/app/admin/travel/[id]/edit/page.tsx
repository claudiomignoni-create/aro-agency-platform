import { notFound } from "next/navigation";
import { updateTravelTripAction } from "@/app/admin/travel/actions";
import { TravelForm } from "@/app/admin/travel/travel-form";
import { getTravelTrip } from "@/lib/travel";
import { listModels } from "@/lib/models";

type EditTravelPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTravelPage({ params }: EditTravelPageProps) {
  const { id } = await params;
  const [trip, models] = await Promise.all([getTravelTrip(id), listModels()]);

  if (!trip) notFound();

  return (
    <TravelForm
      action={updateTravelTripAction.bind(null, trip.id)}
      models={models}
      submitLabel="Salvar viagem"
      trip={trip}
    />
  );
}
