"use client";

import { useState } from "react";

export function PresentationPublicLinkActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="actions">
      <button className="button secondary" onClick={copyLink} type="button">
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      <a className="button secondary" href={url} rel="noreferrer" target="_blank">
        Abrir apresentação pública
      </a>
    </div>
  );
}
