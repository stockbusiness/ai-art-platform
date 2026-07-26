export function HomePage() {
  return (
    <section>
      <p>
        This is the monorepo foundation shell for the admin console. Business screens (tenants,
        users, classes, reservations, ...) are introduced in later PRs.
      </p>
      <p data-testid="build-info">
        Build {__APP_VERSION__} ({import.meta.env.MODE})
      </p>
    </section>
  );
}
