import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_ITEM,
  checkAttachment,
  detectAttachmentType,
  formatBytes,
  parseAttachmentIds,
  sanitizeFilename,
} from "./attachments";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const GIF = text("GIF89a....");
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const PDF = text("%PDF-1.7\n...");

describe("detectAttachmentType (#215)", () => {
  it("recognises images and PDFs by their bytes, whatever the name says", () => {
    expect(detectAttachmentType(PNG, "shot.jpg")?.contentType).toBe("image/png");
    expect(detectAttachmentType(JPG, "photo")?.contentType).toBe("image/jpeg");
    expect(detectAttachmentType(GIF, "a.gif")?.contentType).toBe("image/gif");
    expect(detectAttachmentType(WEBP, "a.webp")?.contentType).toBe("image/webp");
    expect(detectAttachmentType(PDF, "report.pdf")?.kind).toBe("pdf");
  });

  it("accepts UTF-8 text only with a log / text / JSON / HAR extension", () => {
    expect(detectAttachmentType(text("ERROR at line 3"), "console.log")?.contentType).toBe("text/plain; charset=utf-8");
    expect(detectAttachmentType(text('{"log":{}}'), "network.har")?.contentType).toBe("application/json; charset=utf-8");
    expect(detectAttachmentType(text("plain"), "notes")).toBeNull();
  });

  it("never accepts SVG or HTML, which can run scripts", () => {
    expect(detectAttachmentType(text("<svg onload=alert(1)>"), "x.svg")).toBeNull();
    expect(detectAttachmentType(text("<script>alert(1)</script>"), "x.html")).toBeNull();
  });

  it("rejects binary data posing as a log", () => {
    expect(detectAttachmentType(bytes(0x4d, 0x5a, 0x00, 0x01), "app.log")).toBeNull();
    expect(detectAttachmentType(bytes(0xc3, 0x28), "bad.txt")).toBeNull();
  });
});

describe("checkAttachment", () => {
  it("rejects empty and oversized files", () => {
    expect(checkAttachment(new Uint8Array(0), "a.png")).toEqual({ ok: false, error: "That file is empty." });
    const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    big.set(PNG);
    expect(checkAttachment(big, "a.png").ok).toBe(false);
  });

  it("returns the detected type and a cleaned filename", () => {
    expect(checkAttachment(PNG, "../../etc/Screen Shot.png")).toEqual({
      ok: true,
      contentType: "image/png",
      kind: "image",
      filename: "Screen Shot.png",
    });
  });
});

describe("sanitizeFilename", () => {
  it("strips paths, quotes and control characters", () => {
    expect(sanitizeFilename('C:\\Users\\me\\a"b\r\n.log')).toBe("ab.log");
  });

  it("falls back to a generic name", () => {
    expect(sanitizeFilename("..", "image/png")).toBe("attachment.png");
    expect(sanitizeFilename("", "application/pdf")).toBe("attachment.pdf");
  });
});

describe("parseAttachmentIds", () => {
  it("keeps id-shaped values, deduped and capped", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `cmattach0000${i}`);
    expect(parseAttachmentIds(`${ids.join(",")},${ids[0]}`)).toHaveLength(MAX_ATTACHMENTS_PER_ITEM);
    expect(parseAttachmentIds("cmattach00001, ' or 1=1 --,")).toEqual(["cmattach00001"]);
    expect(parseAttachmentIds(null)).toEqual([]);
  });
});

describe("formatBytes", () => {
  it("formats sizes for the file list", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});
