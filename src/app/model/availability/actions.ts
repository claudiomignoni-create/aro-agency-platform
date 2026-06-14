"use server";

import { revalidatePath } from "next/cache";
import { modelAcceptJob, modelDeclineJob } from "@/lib/jobs";

export async function acceptModelJobAction(jobModelId: string) {
  await modelAcceptJob(jobModelId);
  revalidatePath("/model/availability");
}

export async function declineModelJobAction(jobModelId: string) {
  await modelDeclineJob(jobModelId);
  revalidatePath("/model/availability");
}
