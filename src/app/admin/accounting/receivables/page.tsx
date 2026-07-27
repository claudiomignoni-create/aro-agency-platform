import { redirect } from "next/navigation";

type ReceivablesPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function ReceivablesPage({ searchParams }: ReceivablesPageProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (value) query.set(key, value);
  }
  if (!query.has("paymentStatus")) query.set("paymentStatus", "pending");

  redirect(`/admin/accounting?${query.toString()}`);
}
