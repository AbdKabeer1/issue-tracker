import type { ReactNode } from "react";
import { RichText } from "@/components/rich-text";
import { tokenizeMentions } from "@/lib/mentions";

type UserOption = { id: string; name: string };

function MentionSpans({
  text,
  userMap,
}: {
  text: string;
  userMap?: Map<string, string>;
}): ReactNode {
  const tokens = tokenizeMentions(text);

  return tokens.map((token, index) => {
    if (token.type === "text") {
      return <span key={`t-${index}`}>{token.value}</span>;
    }

    if (userMap) {
      const realName = userMap.get(token.userId);
      if (!realName) {
        return <span key={`t-${index}`}>@{token.name}</span>;
      }
      return (
        <span
          key={`m-${index}-${token.userId}`}
          title={realName}
          data-user-id={token.userId}
          className="mx-0.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200"
        >
          @{realName}
        </span>
      );
    }

    return (
      <span
        key={`m-${index}-${token.userId}`}
        title={token.name}
        data-user-id={token.userId}
        className="mx-0.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200"
      >
        @{token.name}
      </span>
    );
  });
}

/** Renders `@[Name](userId)` tags as mention pills (used by the editor preview). */
export function MentionText({
  text,
  users,
}: {
  text: string;
  users?: UserOption[];
}): ReactNode {
  const userMap = users ? new Map(users.map((u) => [u.id, u.name])) : undefined;
  return <MentionSpans text={text} userMap={userMap} />;
}

export function CommentBody({
  body,
  users,
}: {
  body: string;
  users?: UserOption[];
}) {
  const userMap = users
    ? new Map(users.map((u) => [u.id, u.name]))
    : undefined;

  return (
    <RichText
      content={body}
      className="mt-2 text-sm"
      renderMentions={(text) => (
        <MentionSpans text={text} userMap={userMap} />
      )}
    />
  );
}
