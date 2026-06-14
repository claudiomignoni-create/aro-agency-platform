"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveJobForModel,
  createAdminJob,
  jobInputFromFormData,
  updateJobStatus
} from "@/lib/jobs";
import type { JobStatus } from "@/types/database";

export async function createAdminJobAction(formData: FormData) {
  const job = await createAdminJob(jobInputFromFormData(formData));

  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${job.id}`);
}

export async function updateJobStatusAction(jobId: string, status: JobStatus) {
  await updateJobStatus(jobId, status);
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function approveJobForModelAction(jobId: string, modelId: string) {
  await approveJobForModel(jobId, modelId);
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}
