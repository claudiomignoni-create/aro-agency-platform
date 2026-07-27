"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveJobForModel,
  createAdminJob,
  jobInputFromFormData,
  updateAdminJob,
  updateJobStatus
} from "@/lib/jobs";
import type { JobStatus } from "@/types/database";

export async function createAdminJobAction(formData: FormData) {
  let job: { id: string };

  try {
    job = await createAdminJob(jobInputFromFormData(formData));
  } catch (error) {
    const params = new URLSearchParams({
      error: readableError(error),
      type: String(formData.get("type") ?? "job")
    });
    const [modelId] = formData.getAll("model_ids").map(String).filter(Boolean);

    if (modelId) {
      params.set("modelId", modelId);
    }

    redirect(`/admin/calendar/new?${params.toString()}`);
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/jobs");
  redirect(`/admin/calendar/${job.id}`);
}

export async function updateAdminJobAction(jobId: string, formData: FormData) {
  try {
    await updateAdminJob(jobId, jobInputFromFormData(formData));
  } catch (error) {
    const params = new URLSearchParams({
      error: readableError(error)
    });

    redirect(`/admin/calendar/${jobId}/edit?${params.toString()}`);
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/calendar/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
  redirect(`/admin/calendar/${jobId}?notice=updated`);
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível criar este evento de agenda. Revise os dados e tente novamente.";
}

export async function updateJobStatusAction(jobId: string, status: JobStatus) {
  try {
    await updateJobStatus(jobId, status);
  } catch {
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/jobs");
    revalidatePath(`/admin/calendar/${jobId}`);
    revalidatePath(`/admin/jobs/${jobId}`);
    redirect(`/admin/calendar/${jobId}?error=job_status_failed`);
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/calendar/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
  redirect(`/admin/calendar/${jobId}?notice=status_${status}`);
}

export async function approveJobForModelAction(jobId: string, modelId: string) {
  try {
    await approveJobForModel(jobId, modelId);
  } catch {
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/jobs");
    revalidatePath(`/admin/calendar/${jobId}`);
    revalidatePath(`/admin/jobs/${jobId}`);
    redirect(`/admin/calendar/${jobId}?error=model_send_failed`);
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/calendar/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
  redirect(`/admin/calendar/${jobId}?notice=model_sent`);
}
