import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toaster } from "sonner";

describe("debug", () => {
  it("renders with Toaster as proper wrapper (renders children)", () => {
    const utils = render(
      <div>
        <button type="button">Log in</button>
        <a href="/signup">Create an account</a>
      </div>,
      {
        wrapper: ({ children }) => (
          <>
            <Toaster richColors />
            {children}
          </>
        ),
      },
    );
    console.log("===== DOM =====");
    console.log(utils.container.innerHTML);
    console.log("===== END =====");
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("renders with Toaster as wrapper that returns only Toaster (children discarded)", () => {
    const utils = render(
      <div>
        <button type="button">Log in</button>
      </div>,
      {
        wrapper: () => <Toaster richColors />,
      },
    );
    console.log("===== DOM (children-discarding wrapper) =====");
    console.log(utils.container.innerHTML);
    console.log("===== END =====");
    // This will fail: Toaster discards children.
    expect(screen.queryByRole("button")).toBeNull();
  });
});
