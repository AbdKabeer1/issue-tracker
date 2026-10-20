import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl, getSiteUrl } from "./site-url";

const ORIGINAL_AUTH = process.env.AUTH_URL;
const ORIGINAL_NEXTAUTH = process.env.NEXTAUTH_URL;

afterEach(() => {
  if (ORIGINAL_AUTH === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = ORIGINAL_AUTH;
  if (ORIGINAL_NEXTAUTH === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH;
});

describe("getSiteUrl", () => {
  it("strips trailing slash from AUTH_URL", () => {
    process.env.AUTH_URL = "https://contributors.zedu.chat/bug-tracker/";
    delete process.env.NEXTAUTH_URL;
    expect(getSiteUrl()).toBe("https://contributors.zedu.chat/bug-tracker");
  });

  it("strips /api/auth from NEXTAUTH_URL", () => {
    delete process.env.AUTH_URL;
    process.env.NEXTAUTH_URL =
      "https://contributors.zedu.chat/bug-tracker/api/auth";
    expect(getSiteUrl()).toBe("https://contributors.zedu.chat/bug-tracker");
  });
});

describe("absoluteUrl", () => {
  it("joins path under the site origin including basePath", () => {
    process.env.AUTH_URL = "https://contributors.zedu.chat/bug-tracker";
    expect(absoluteUrl("/issues/abc")).toBe(
      "https://contributors.zedu.chat/bug-tracker/issues/abc",
    );
    expect(absoluteUrl("/zedu-mark.svg")).toBe(
      "https://contributors.zedu.chat/bug-tracker/zedu-mark.svg",
    );
  });
});
