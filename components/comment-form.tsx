"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { addCommentAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";
import {
  filterUsersForMention,
  getMentionQuery,
  insertMention,
  type MentionQuery,
} from "@/lib/mentions";

type UserOption = { id: string; name: string };

export function CommentForm({
  bugId,
  users,
}: {
  bugId: string;
  users: UserOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listboxId = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(
    () =>
      mention ? filterUsersForMention(users, mention.query) : [],
    [mention, users],
  );

  const showSuggestions = mention !== null && suggestions.length > 0;

  const syncMentionFromCaret = useCallback((value: string, caret: number) => {
    setMention(getMentionQuery(value, caret));
    setActiveIndex(0);
  }, []);

  const applyMention = useCallback(
    (user: UserOption) => {
      const textarea = textareaRef.current;
      if (!textarea || !mention) return;

      const caret = textarea.selectionStart ?? body.length;
      const next = insertMention(body, mention, caret, user.name, user.id);
      setBody(next.value);
      setMention(null);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(next.caret, next.caret);
      });
    },
    [body, mention],
  );

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!showSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const user = suggestions[activeIndex];
      if (user) applyMention(user);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setMention(null);
    }
  }

  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await addCommentAction(bugId, formData);
          if (result.error) {
            setError(result.error);
          } else {
            setBody("");
            setMention(null);
            formRef.current?.reset();
          }
        });
      }}
    >
      <label htmlFor="body" className="block text-sm font-medium text-slate-700">
        Add a comment
      </label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="body"
          name="body"
          required
          rows={3}
          value={body}
          onChange={(event) => {
            const value = event.target.value;
            setBody(value);
            syncMentionFromCaret(value, event.target.selectionStart ?? 0);
          }}
          onClick={(event) => {
            syncMentionFromCaret(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? 0,
            );
          }}
          onKeyUp={(event) => {
            if (
              event.key === "ArrowDown" ||
              event.key === "ArrowUp" ||
              event.key === "Enter" ||
              event.key === "Tab" ||
              event.key === "Escape"
            ) {
              return;
            }
            syncMentionFromCaret(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? 0,
            );
          }}
          onKeyDown={onKeyDown}
          placeholder="Share triage notes… Type @ to mention someone"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            showSuggestions
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          role="combobox"
        />
        {showSuggestions ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {suggestions.map((user, index) => {
              const active = index === activeIndex;
              return (
                <li key={user.id} role="option" aria-selected={active}>
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    className={`flex w-full px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-teal-50 text-teal-900"
                        : "text-slate-800 hover:bg-slate-50"
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyMention(user);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {user.name}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Mentions are stored in the comment and highlighted for readers. Push
        notifications are not sent.
      </p>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}
