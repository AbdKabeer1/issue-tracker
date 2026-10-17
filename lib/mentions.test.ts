import { describe, expect, it } from "vitest";
import {
  extractMentionedUserIds,
  filterUsersForMention,
  formatMention,
  getMentionQuery,
  insertMention,
  newlyMentionedUserIds,
  normalizeMentions,
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

  it("returns null inside inline code", () => {
    const value = "run `@al";
    expect(getMentionQuery(value, value.length)).toBeNull();
  });

  it("returns null inside a fenced code block", () => {
    const value = "```\nuser @al";
    expect(getMentionQuery(value, value.length)).toBeNull();
  });

  it("still detects mentions after a closed code span", () => {
    const value = "`code` then @al";
    expect(getMentionQuery(value, value.length)).toEqual({
      start: 12,
      query: "al",
    });
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

describe("normalizeMentions", () => {
  const usersMap = new Map([
    [aliceId, "Alice Smith"],
    [bobId, "Bob Jones"],
  ]);

  it("canonicalizes a valid mention with the user's real name", () => {
    const input = `Hi @[Alice](${aliceId})!`;
    expect(normalizeMentions(input, usersMap)).toBe(
      `Hi @[Alice Smith](${aliceId})!`,
    );
  });

  it("rewrites an unknown user ID to plain text @Name", () => {
    const input = "Hi @[Mark Essien](fake123)";
    expect(normalizeMentions(input, usersMap)).toBe("Hi @Mark Essien");
  });

  it("corrects a mismatched name to the user's real name from the database", () => {
    const input = `Assigned to @[Super Admin](${aliceId}) by mistake`;
    expect(normalizeMentions(input, usersMap)).toBe(
      `Assigned to @[Alice Smith](${aliceId}) by mistake`,
    );
  });

  it("handles mixed valid, unknown, and plain text mentions", () => {
    const input = `@[Imposter](${aliceId}) met @[Unknown](no-id) and @[Bob](${bobId})`;
    expect(normalizeMentions(input, usersMap)).toBe(
      `@[Alice Smith](${aliceId}) met @Unknown and @[Bob Jones](${bobId})`,
    );
  });
});

describe("newlyMentionedUserIds (#228)", () => {
  it("returns people tagged only in the new text", () => {
    const before = "Looks broken on staging.";
    const after = `Looks broken on staging. cc @[Alice](${aliceId})`;
    expect(newlyMentionedUserIds(before, after)).toEqual([aliceId]);
  });

  it("does not re-notify people who were already tagged", () => {
    const before = `cc @[Alice](${aliceId})`;
    const after = `cc @[Alice](${aliceId}) and @[Bob](${bobId})`;
    expect(newlyMentionedUserIds(before, after)).toEqual([bobId]);
  });

  it("returns nothing when an edit only removes or keeps mentions", () => {
    const before = `cc @[Alice](${aliceId}) and @[Bob](${bobId})`;
    expect(newlyMentionedUserIds(before, `cc @[Alice](${aliceId})`)).toEqual([]);
    expect(newlyMentionedUserIds(before, before)).toEqual([]);
  });
});
