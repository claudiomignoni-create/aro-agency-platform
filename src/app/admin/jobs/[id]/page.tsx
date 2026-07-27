import { redirect } from "next/navigation";

type AdminJobDetailRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function AdminJobDetailRedirectPage({
  params,
  searchParams
}: AdminJobDetailRedirectPageProps) {
  const { id } = await params;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (value) {
      query.set(key, value);
    }
  }

  redirect(`/admin/calendar/${id}${query.toString() ? `?${query.toString()}` : ""}`);
}
