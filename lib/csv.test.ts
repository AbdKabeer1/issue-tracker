import { describe, expect, it } from "vitest";
import { CSV_EOL, csvCell, csvRow } from "./csv";

describe("csvCell", () => {
  it("leaves an ordinary value alone", () => {
    expect(csvCell("open")).toBe("open");
    expect(csvCell(42)).toBe("42");
  });

  it("writes nothing for null and undefined, not the words", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes a value containing a comma", () => {
    expect(csvCell("Login fails, sometimes")).toBe('"Login fails, sometimes"');
  });

  it("doubles quotes inside a quoted value", () => {
    expect(csvCell('He said "no"')).toBe('"He said ""no"""');
  });

  it("quotes a value containing a newline, so the row survives", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("writes dates as ISO, not as a locale string", () => {
    expect(csvCell(new Date("2026-10-17T06:42:00.000Z"))).toBe(
      "2026-10-17T06:42:00.000Z",
    );
  });

  it("writes booleans as true and false", () => {
    expect(csvCell(true)).toBe("true");
    expect(csvCell(false)).toBe("false");
  });

  describe("formula injection", () => {
    // An issue title is free text written by any signed-in user, and it ends
    // up in a file someone else opens in Excel.
    it.each(["=1+1", "+1", "-1", "@SUM(A1)", "=cmd|'/c calc'!A1"])(
      "defuses %s with a leading tab",
      (payload) => {
        expect(csvCell(payload).startsWith("\t")).toBe(true);
      },
    );

    it("quotes the defused value when it also contains a comma", () => {
      const cell = csvCell("=cmd|'/c calc'!A1, really");
      expect(cell.startsWith('"\t')).toBe(true);
      expect(cell.endsWith('"')).toBe(true);
    });

    it("leaves a minus sign in the middle of text alone", () => {
      expect(csvCell("re-open")).toBe("re-open");
    });
  });
});

describe("csvRow", () => {
  it("joins with commas and ends with CRLF", () => {
    expect(csvRow(["a", "b"])).toBe(`a,b${CSV_EOL}`);
  });

  it("keeps empty columns as empty fields, so columns stay aligned", () => {
    expect(csvRow(["a", null, "c"])).toBe(`a,,c${CSV_EOL}`);
  });

  it("round-trips a row that contains every awkward character", () => {
    const row = csvRow(['has "quotes"', "has, comma", "has\nnewline"]);
    expect(row).toBe(
      `"has ""quotes""","has, comma","has\nnewline"${CSV_EOL}`,
    );
  });
});
