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
    <main className="page stack">
      <section className="panel stack">
        <span className="eyebrow">Login</span>
        <h1>Acesse o sistema</h1>
        <p>Entre com o e-mail e senha cadastrados no Supabase Auth.</p>
        {errorMessage ? <p className="notice">{errorMessage}</p> : null}
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
      </section>
    </main>
  );
}
