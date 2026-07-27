import { redirect } from "next/navigation";

type AdminJobsRedirectPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function AdminJobsRedirectPage({
  searchParams
}: AdminJobsRedirectPageProps) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`/admin/calendar${params.toString() ? `?${params.toString()}` : ""}`);
}
