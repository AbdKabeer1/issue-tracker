// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

afterEach(cleanup);

describe("Field Guide controls", () => {
  it("prints primary actions as square rubber stamps instead of SaaS pills", () => {
    render(<Button>Record specimen</Button>);

    const button = screen.getByRole("button", { name: "Record specimen" });
    expect(button).toHaveClass("rounded-[3px]");
    expect(button).toHaveClass("uppercase");
    expect(button).toHaveClass("tracking-[0.08em]");
    expect(button).toHaveClass("shadow-[2px_2px_0_var(--zk-text)]");
    expect(button).not.toHaveClass("rounded-full");
  });

  it("sets form fields as ruled paper boxes without floating shadows", () => {
    render(
      <>
        <Input aria-label="Title" />
        <Textarea aria-label="Notes" />
        <Select aria-label="Status"><option>Open</option></Select>
      </>,
    );

    for (const control of [
      screen.getByRole("textbox", { name: "Title" }),
      screen.getByRole("textbox", { name: "Notes" }),
      screen.getByRole("combobox", { name: "Status" }),
    ]) {
      expect(control).toHaveClass("rounded-[3px]");
      expect(control).toHaveClass("border-zk-border");
      expect(control).toHaveClass("bg-zk-surface");
      expect(control).toHaveClass("shadow-none");
    }
  });

  it("renders badges as outlined catalogue stamps", () => {
    render(<Badge>Confirmed</Badge>);

    const stamp = screen.getByText("Confirmed");
    expect(stamp).toHaveClass("rounded-[3px]");
    expect(stamp).toHaveClass("border");
    expect(stamp).toHaveClass("uppercase");
    expect(stamp).toHaveClass("tracking-[0.08em]");
  });
});
