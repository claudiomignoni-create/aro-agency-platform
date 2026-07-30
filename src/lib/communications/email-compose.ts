import type { EmailRecipientOption } from "@/lib/communications/email-center";

export type EmailComposerRecipientTab = "organizations" | "contacts";
export type EmailPresentationLayout = "grid" | "list" | "book" | "polaroids";
export type EmailTextFormat = "bold" | "italic" | "link" | "list";

export const emailPresentationLayouts: Array<{
  description: string;
  id: EmailPresentationLayout;
  label: string;
}> = [
  { description: "Padrão", id: "grid", label: "Grid" },
  { description: "Minimalista", id: "list", label: "Lista" },
  { description: "Editorial", id: "book", label: "Book" },
  { description: "Digitais", id: "polaroids", label: "Polaroids" }
];

function normalizedSearch(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function filterEmailComposerRecipients(
  recipients: EmailRecipientOption[],
  tab: EmailComposerRecipientTab,
  query: string
) {
  const categories =
    tab === "organizations"
      ? new Set<EmailRecipientOption["category"]>(["agency", "client"])
      : new Set<EmailRecipientOption["category"]>(["agency_contact", "client_contact"]);
  const search = normalizedSearch(query);

  return recipients.filter((recipient) => {
    if (!categories.has(recipient.category)) return false;
    if (!search) return true;

    return [recipient.name, recipient.email, recipient.organization]
      .filter(Boolean)
      .some((value) => normalizedSearch(value!).includes(search));
  });
}

export function formatEmailComposerSelection(
  value: string,
  start: number,
  end: number,
  format: EmailTextFormat
) {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const selected = value.slice(safeStart, safeEnd);
  let replacement = selected;
  let selectionStart = safeStart;
  let selectionEnd = safeEnd;

  if (format === "bold") {
    const content = selected || "texto";
    replacement = `**${content}**`;
    selectionStart = safeStart + 2;
    selectionEnd = selectionStart + content.length;
  } else if (format === "italic") {
    const content = selected || "texto";
    replacement = `_${content}_`;
    selectionStart = safeStart + 1;
    selectionEnd = selectionStart + content.length;
  } else if (format === "link") {
    const content = selected || "texto";
    replacement = `[${content}](https://)`;
    selectionStart = safeStart + content.length + 3;
    selectionEnd = selectionStart + "https://".length;
  } else {
    const content = selected || "Item";
    replacement = content
      .split("\n")
      .map((line) => `- ${line.replace(/^-\s*/, "")}`)
      .join("\n");
    selectionStart = safeStart;
    selectionEnd = safeStart + replacement.length;
  }

  return {
    selectionEnd,
    selectionStart,
    value: `${value.slice(0, safeStart)}${replacement}${value.slice(safeEnd)}`
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineEmailHtml(value: string) {
  return escapeHtml(value)
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)<]+)\)/g,
      '<a href="$2" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");
}

export function emailHtmlFromComposerText(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^-\s+/.test(line))) {
        return `<ul>${lines
          .map((line) => `<li>${inlineEmailHtml(line.replace(/^-\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }

      return `<p>${lines.map(inlineEmailHtml).join("<br>")}</p>`;
    })
    .join("");
}

export function emailPlainTextFromComposerText(value: string) {
  return value
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)<]+)\)/g, "$1: $2")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^-\s+/gm, "• ");
}
