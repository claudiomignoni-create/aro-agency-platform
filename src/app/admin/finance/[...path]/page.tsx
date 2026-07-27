import { redirect } from "next/navigation";

type FinanceNestedRedirectPageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function FinanceNestedRedirectPage({
  params,
  searchParams
}: FinanceNestedRedirectPageProps) {
  const { path = [] } = await params;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (value) query.set(key, value);
  }

  const suffix = path.length ? `/${path.join("/")}` : "";
  redirect(`/admin/accounting${suffix}${query.toString() ? `?${query.toString()}` : ""}`);
}
