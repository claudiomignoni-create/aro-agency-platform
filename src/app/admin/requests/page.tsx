import Link from "next/link";

export default function AdminRequestsPage() {
  return (
    <section className="panel stack">
      <span className="eyebrow">Admin</span>
      <h2>Pedidos</h2>
      <p>Pedidos agora fazem parte da área Agenda.</p>
      <div className="actions">
        <Link className="button" href="/admin/calendar">
          Ir para Agenda
        </Link>
      </div>
    </section>
  );
}
