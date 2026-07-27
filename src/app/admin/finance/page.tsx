import { redirect } from "next/navigation";

type FinanceRedirectPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function FinanceRedirectPage({ searchParams }: FinanceRedirectPageProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (value) params.set(key, value);
  }

  redirect(`/admin/accounting${params.toString() ? `?${params.toString()}` : ""}`);
}
