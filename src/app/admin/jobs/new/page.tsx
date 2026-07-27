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

  redirect(`/admin/calendar/new${params.toString() ? `?${params.toString()}` : ""}`);
}
