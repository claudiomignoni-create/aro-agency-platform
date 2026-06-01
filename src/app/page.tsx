import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getDefaultRouteForRole } from "@/lib/navigation";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(getDefaultRouteForRole(profile.role));
  }

  return (
    <main className="page stack">
      <section className="panel stack">
        <span className="eyebrow">ARO Lab</span>
        <h1>Sistema interno</h1>
        <p>
          Aplicação independente para portal de modelos, portal de clientes e
          painel administrativo.
        </p>
        <div className="grid">
          <Link className="button" href="/login">
            Entrar
          </Link>
          <Link className="button" href="/admin">
            Admin
          </Link>
          <Link className="button" href="/model">
            Modelo
          </Link>
          <Link className="button" href="/client">
            Cliente
          </Link>
        </div>
      </section>
    </main>
  );
}
