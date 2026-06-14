"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientJobRequest, jobInputFromFormData } from "@/lib/jobs";

export async function createClientJobAction(formData: FormData) {
  let job: { id: string };

  try {
    job = await createClientJobRequest(jobInputFromFormData(formData));
  } catch (error) {
    const params = new URLSearchParams({
      date: String(formData.get("date") ?? "2026-06-13"),
      error: readableError(error)
    });
    const [modelId] = formData.getAll("model_ids").map(String).filter(Boolean);

    if (modelId) {
      params.set("modelId", modelId);
    }

    if (formData.get("quote_requested") === "on") {
      params.set("quote", "1");
    }

    redirect(`/client/jobs/new?${params.toString()}`);
  }

  revalidatePath("/client/jobs");
  redirect(`/client/jobs?created=${job.id}`);
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível enviar esta solicitação. Revise os dados e tente novamente.";
}
