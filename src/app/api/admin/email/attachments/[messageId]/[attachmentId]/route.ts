import { requireRole } from "@/lib/auth";
import {
  getGmailAttachment,
  GmailMailboxError
} from "@/lib/communications/gmail-mailbox-server";

type RouteContext = {
  params: Promise<{ attachmentId: string; messageId: string }>;
};

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const profile = await requireRole(["admin"]);
  const { attachmentId, messageId } = await context.params;

  try {
    const attachment = await getGmailAttachment(
      profile.id,
      messageId,
      attachmentId
    );
    return new Response(new Uint8Array(attachment.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(attachment.filename),
        "Content-Length": String(attachment.size),
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const status =
      error instanceof GmailMailboxError && error.code === "attachment_unavailable"
        ? 404
        : 503;
    return Response.json({ code: "attachment-unavailable" }, { status });
  }
}
