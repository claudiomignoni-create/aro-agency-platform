"use server";

import { revalidatePath } from "next/cache";
import { markNotificationAsRead } from "@/lib/notifications";

export async function markNotificationReadAction(id: string) {
  await markNotificationAsRead(id);
  revalidatePath("/model");
  revalidatePath("/model/notifications");
}
