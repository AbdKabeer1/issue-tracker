import { describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

/** A minimal stand-in for the bits of the DOM the fallback touches. */
function fakeDocument(execResult: boolean | "throws") {
  const appended: { value: string; removed: boolean }[] = [];
  const focus = vi.fn();
  const doc = {
    body: {
      appendChild: (el: { value: string; removed: boolean }) => appended.push(el),
    },
    activeElement: { focus },
    createElement: () => {
      const el = {
        value: "",
        removed: false,
        style: {} as Record<string, string>,
        setAttribute: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn(),
        remove() {
          el.removed = true;
        },
      };
      return el;
    },
    execCommand: vi.fn(() => {
      if (execResult === "throws") throw new Error("nope");
      return execResult;
    }),
  };
  return { doc: doc as unknown as Document, appended, focus };
}

describe("copyText", () => {
  it("uses the async clipboard when it exists", async () => {
    const writeText = vi.fn(async () => {});
    const ok = await copyText("https://x/bugs/1", {
      navigator: { clipboard: { writeText } } as unknown as Navigator,
    });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://x/bugs/1");
  });

  it("falls back to a selected textarea when the clipboard API is missing", async () => {
    const { doc, appended, focus } = fakeDocument(true);
    const ok = await copyText("https://x/bugs/1", { navigator: {} as Navigator, document: doc });
    expect(ok).toBe(true);
    expect(appended[0].value).toBe("https://x/bugs/1");
    expect(appended[0].removed).toBe(true);
    // Focus goes back where it was, rather than to <body>.
    expect(focus).toHaveBeenCalled();
  });

  it("falls back when the clipboard API refuses, e.g. without permission", async () => {
    const { doc } = fakeDocument(true);
    const writeText = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });
    const ok = await copyText("t", {
      navigator: { clipboard: { writeText } } as unknown as Navigator,
      document: doc,
    });
    expect(ok).toBe(true);
  });

  it("reports failure honestly rather than claiming a copy", async () => {
    expect(await copyText("t", { navigator: {} as Navigator, document: fakeDocument(false).doc })).toBe(false);
    expect(await copyText("t", { navigator: {} as Navigator, document: fakeDocument("throws").doc })).toBe(false);
    expect(await copyText("t", { navigator: {} as Navigator })).toBe(false);
  });

  it("cleans up the textarea even when copying throws", async () => {
    const { doc, appended } = fakeDocument("throws");
    await copyText("t", { navigator: {} as Navigator, document: doc });
    expect(appended[0].removed).toBe(true);
  });
});
