import "./public-presentation.css";

export default function PublicPresentationLoading() {
  return (
    <main aria-busy="true" aria-label="Loading private presentation" className="aro-public-loading">
      <aside>
        <span className="aro-public-loading-mark" />
        <span />
        <span />
        <span />
      </aside>
      <section>
        <nav />
        <div>
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
