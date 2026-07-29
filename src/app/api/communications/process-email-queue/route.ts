import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/communications/email-delivery-server";
import { classifyEmailDeliveryError } from "@/lib/communications/email-delivery-errors";

function authorized(request: Request) {
  const secret = process.env.COMMUNICATIONS_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function processRequest(request: Request) {
  if (process.env.VERCEL_ENV === "preview") {
    return NextResponse.json({ error: "preview-disabled" }, { status: 403 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processEmailQueue(5);
    return NextResponse.json(result);
  } catch (error) {
    const classified = classifyEmailDeliveryError(error);
    return NextResponse.json(
      { error: classified.code, message: classified.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return processRequest(request);
}

export async function POST(request: Request) {
  return processRequest(request);
}
