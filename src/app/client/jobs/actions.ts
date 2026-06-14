"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientJobRequest, jobInputFromFormData } from "@/lib/jobs";

export async function createClientJobAction(formData: FormData) {
  const job = await createClientJobRequest(jobInputFromFormData(formData));

  revalidatePath("/client/jobs");
  redirect(`/client/jobs?created=${job.id}`);
}
