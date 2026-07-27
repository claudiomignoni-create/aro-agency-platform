import Link from "next/link";

export function ModelPortalSection({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="panel stack">
      <span className="eyebrow">ARO Model Portal</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button secondary" href="/model">Voltar ao portal</Link>
    </section>
  );
}
