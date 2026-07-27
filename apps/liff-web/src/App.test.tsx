import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./App.js";

function renderAtPath(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("App", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renders the LIFF shell heading on the home route", () => {
    renderAtPath("/");
    expect(screen.getByRole("heading", { name: "AI Art Platform — LIFF" })).toBeInTheDocument();
    expect(screen.getByTestId("build-info")).toBeInTheDocument();
  });

  it("renders the auth callback placeholder", () => {
    renderAtPath("/auth/callback");
    expect(
      screen.getByText("LIFF authentication is not implemented in this build."),
    ).toBeInTheDocument();
  });

  it("renders the maintenance page", () => {
    renderAtPath("/maintenance");
    expect(screen.getByText("The service is temporarily under maintenance.")).toBeInTheDocument();
  });
});
