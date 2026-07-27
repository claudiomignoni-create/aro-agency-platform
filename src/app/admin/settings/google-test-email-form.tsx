"use client";

const aroGoogleEmail = "claudio@arolab.co";

export function GoogleTestEmailForm() {
  return (
    <form
      action="/api/integrations/google/test-email"
      method="post"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Enviar um e-mail real de teste para ${aroGoogleEmail}?`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button className="button secondary" type="submit">
        Enviar teste para {aroGoogleEmail}
      </button>
    </form>
  );
}
