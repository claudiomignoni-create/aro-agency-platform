import { redirect } from "next/navigation";

type NewAdminJobRedirectPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function NewAdminJobRedirectPage({
  searchParams
}: NewAdminJobRedirectPageProps) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  if (!params.get("type")) {
    params.set("type", "job");
  }

  redirect(`/admin/calendar/new${params.toString() ? `?${params.toString()}` : ""}`);
}
