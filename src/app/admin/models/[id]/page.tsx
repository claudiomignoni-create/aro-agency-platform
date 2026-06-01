import { redirect } from "next/navigation";

type ModelRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ModelRedirectPage({
  params
}: ModelRedirectPageProps) {
  const { id } = await params;
  redirect(`/admin/models/${id}/edit`);
}
