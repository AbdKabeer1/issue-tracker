import { describe, expect, it } from "vitest";
import {
  extractMentionedUserIds,
  filterUsersForMention,
  formatMention,
  getMentionQuery,
  insertMention,
  tokenizeMentions,
} from "./mentions";

const aliceId = "clxxxxxxxxxxxxxxxxxxxxxxxx1";
const bobId = "clxxxxxxxxxxxxxxxxxxxxxxxx2";

describe("formatMention", () => {
  it("formats a soft-mention tag", () => {
    expect(formatMention("Alice Smith", aliceId)).toBe(
      `@[Alice Smith](${aliceId})`,
    );
  });

  it("strips brackets from display names", () => {
    expect(formatMention("Al[ice]", aliceId)).toBe(`@[Alice](${aliceId})`);
  });
});

describe("tokenizeMentions", () => {
  it("returns a single text token for plain comments", () => {
    expect(tokenizeMentions("Looks good on staging.")).toEqual([
      { type: "text", value: "Looks good on staging." },
    ]);
  });

  it("splits text and mention tags", () => {
    const body = `Hey @[Alice](${aliceId}), please check.`;
    expect(tokenizeMentions(body)).toEqual([
      { type: "text", value: "Hey " },
      { type: "mention", name: "Alice", userId: aliceId },
      { type: "text", value: ", please check." },
    ]);
  });

  it("keeps malformed tags as plain text", () => {
    const body = "Broken @[Alice(missing) and @[Bob]() end";
    const tokens = tokenizeMentions(body);
    expect(tokens.every((t) => t.type === "text")).toBe(true);
    expect(tokens.map((t) => (t.type === "text" ? t.value : "")).join("")).toBe(
      body,
    );
  });

  it("does not throw on empty or odd input", () => {
    expect(tokenizeMentions("")).toEqual([{ type: "text", value: "" }]);
    expect(tokenizeMentions("@[[[]]](())")).toEqual([
      { type: "text", value: "@[[[]]](())" },
    ]);
  });
});

describe("extractMentionedUserIds", () => {
  it("returns unique user ids from well-formed tags", () => {
    const body = `@[Alice](${aliceId}) and @[Bob](${bobId}) then @[Alice](${aliceId}) again`;
    expect(extractMentionedUserIds(body)).toEqual([aliceId, bobId]);
  });

  it("ignores malformed tags", () => {
    expect(extractMentionedUserIds("hi @alice @[Bob]")).toEqual([]);
  });
});

describe("getMentionQuery", () => {
  it("detects an open @ query at the caret", () => {
    const value = "Hello @al";
    expect(getMentionQuery(value, value.length)).toEqual({
      start: 6,
      query: "al",
    });
  });

  it("returns null inside a completed mention tag", () => {
    const value = `Thanks @[Alice](${aliceId})`;
    expect(getMentionQuery(value, value.length)).toBeNull();
  });

  it("returns null when @ is mid-word", () => {
    expect(getMentionQuery("email@alice", 11)).toBeNull();
  });
});

describe("filterUsersForMention", () => {
  const users = [
    { id: aliceId, name: "Alice Smith" },
    { id: bobId, name: "Bob Jones" },
  ];

  it("filters case-insensitively by name", () => {
    expect(filterUsersForMention(users, "ali")).toEqual([users[0]]);
  });

  it("returns a limited list when query is empty", () => {
    expect(filterUsersForMention(users, "", 1)).toEqual([users[0]]);
  });
});

describe("insertMention", () => {
  it("replaces the open query with a formatted tag and trailing space", () => {
    const value = "Hi @al";
    const mention = getMentionQuery(value, value.length);
    expect(mention).not.toBeNull();
    if (!mention) return;

    const result = insertMention(value, mention, value.length, "Alice", aliceId);
    expect(result.value).toBe(`Hi @[Alice](${aliceId}) `);
    expect(result.caret).toBe(result.value.length);
  });
});
