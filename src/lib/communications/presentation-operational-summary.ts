export type PresentationOperationalMetric =
  | "deliveries"
  | "models"
  | "recipients"
  | "selections";

type PresentationRow = {
  id: string;
};

type CountRow = {
  presentation_id: string | null;
};

type DeliveryRow = CountRow & {
  created_at: string;
};

export function buildPresentationOperationalSummaries<T extends PresentationRow>(
  presentations: T[],
  rows: {
    deliveries: DeliveryRow[];
    models: CountRow[];
    recipients: CountRow[];
    selections: CountRow[];
  },
  unavailableMetrics: PresentationOperationalMetric[]
) {
  const counts = (items: CountRow[]) =>
    items.reduce<Record<string, number>>((result, row) => {
      if (row.presentation_id) {
        result[row.presentation_id] = (result[row.presentation_id] ?? 0) + 1;
      }
      return result;
    }, {});
  const modelCounts = counts(rows.models);
  const recipientCounts = counts(rows.recipients);
  const selectionCounts = counts(rows.selections);
  const lastDeliveries = rows.deliveries.reduce<Record<string, string>>(
    (result, email) => {
      if (email.presentation_id && !result[email.presentation_id]) {
        result[email.presentation_id] = email.created_at;
      }
      return result;
    },
    {}
  );

  return presentations.map((presentation) => ({
    ...presentation,
    last_delivery_at: unavailableMetrics.includes("deliveries")
      ? null
      : lastDeliveries[presentation.id] ?? null,
    model_count: unavailableMetrics.includes("models")
      ? null
      : modelCounts[presentation.id] ?? 0,
    recipient_count: unavailableMetrics.includes("recipients")
      ? null
      : recipientCounts[presentation.id] ?? 0,
    selection_count: unavailableMetrics.includes("selections")
      ? null
      : selectionCounts[presentation.id] ?? 0
  }));
}
