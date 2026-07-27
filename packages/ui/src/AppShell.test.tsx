import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
  it("renders the title and children", () => {
    render(
      <AppShell title="Admin">
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
