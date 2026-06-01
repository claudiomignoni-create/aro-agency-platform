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
    <main className="page entry-page">
      <section className="entry-stage">
        <div className="entry-copy">
          <Link className="brand-mark" href="/">
            <strong>ARO</strong>LAB
          </Link>
          <h1 className="hero-title">
            We don&apos;t just sign faces, we craft obsessions.
          </h1>
          <p>
            Sistema interno para casting, gestão de modelos, clientes e
            operação comercial com a precisão visual da AROLAB.
          </p>
        </div>
        <div className="panel stack entry-panel">
          <span className="eyebrow">Acesso privado</span>
          <h2>Entrar na plataforma</h2>
          <p>Escolha sua área de trabalho para continuar.</p>
          <div className="grid">
            <Link className="button" href="/login">
              Entrar
            </Link>
            <Link className="button secondary" href="/admin">
              Admin
            </Link>
            <Link className="button secondary" href="/model">
              Modelo
            </Link>
            <Link className="button secondary" href="/client">
              Cliente
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
