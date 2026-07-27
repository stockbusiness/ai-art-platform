import type { ReactNode } from "react";

export interface AppShellProps {
  title: string;
  children: ReactNode;
}

/**
 * Minimal page shell shared by admin-web and liff-web. Intentionally has no
 * navigation, theming, or design-system opinions yet — those are out of
 * scope for PR-01.
 */
export function AppShell({ title, children }: AppShellProps) {
  return (
    <div data-testid="app-shell">
      <header>
        <h1>{title}</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}
