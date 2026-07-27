# @ai-art-platform/ui

Minimal shared React UI primitives.

## Responsibility

- `AppShell`: bare page wrapper (title + content slot).
- `LoadingState`: accessible loading indicator (`role="status"`).

`react` is a peer dependency — this package does not bundle its own React
instance, so both `admin-web` and `liff-web` share one.

## Non-goals (PR-01)

- No design system, theming, or component library beyond these two
  primitives.
