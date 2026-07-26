import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingState } from "./LoadingState.js";

describe("LoadingState", () => {
  it("renders a default label", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("renders a custom label", () => {
    render(<LoadingState label="Fetching classes..." />);
    expect(screen.getByRole("status")).toHaveTextContent("Fetching classes...");
  });
});
