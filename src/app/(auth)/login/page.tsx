import Image from "next/image";
import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_credentials: "E-mail ou senha inválidos.",
  no_session: "Não foi possível criar a sessão.",
  missing_profile: "Usuário sem perfil configurado."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className="page entry-page">
      <section className="entry-stage">
        <div className="entry-copy">
          <span className="brand-mark">
            <Image alt="ARO" height={48} priority src="/brand/aro-mark.png" width={48} />
            <strong>ARO</strong>
          </span>
          <h1 className="hero-title">Casting operations, refined.</h1>
          <p>
            Acesso seguro para administrar talentos, briefings, revisões e
            material comercial.
          </p>
        </div>
        <div className="panel stack entry-panel">
          <span className="eyebrow">Login</span>
          <h2>Acesse o sistema</h2>
          <p>Entre com o e-mail e senha cadastrados.</p>
          {errorMessage ? <p className="notice error">{errorMessage}</p> : null}
          <form action={signIn} className="form">
            <input name="next" type="hidden" value={params.next ?? ""} />
            <label>
              E-mail
              <input name="email" required type="email" />
            </label>
            <label>
              Senha
              <input name="password" required type="password" />
            </label>
            <button className="button" type="submit">
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
