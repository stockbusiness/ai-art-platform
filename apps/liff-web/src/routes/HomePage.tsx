export function HomePage() {
  return (
    <section>
      <p>
        This is the monorepo foundation shell for the LIFF / end-user app. LINE SDK integration and
        tenant resolution are introduced in Phase 2.
      </p>
      <p data-testid="build-info">
        Build {__APP_VERSION__} ({import.meta.env.MODE})
      </p>
    </section>
  );
}
