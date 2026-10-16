"use client";

import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  filterUsersForMention,
  getMentionQuery,
  insertMention,
  type MentionQuery,
} from "@/lib/mentions";
import { applyTextChange } from "@/lib/editor-dom";

export type MentionUser = { id: string; name: string };

/**
 * Shared @mention autocomplete state so every editor (bug description,
 * comments and replies) behaves the same.
 */
export function useMentionSuggestions({
  users,
  value,
  onChange,
  textareaRef,
  enabled = true,
}: {
  users: MentionUser[];
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  enabled?: boolean;
}) {
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(
    () => (mention ? filterUsersForMention(users, mention.query) : []),
    [mention, users],
  );

  const showSuggestions = enabled && mention !== null && suggestions.length > 0;

  const sync = useCallback(
    (nextValue: string, caret: number) => {
      if (!enabled) return;
      setMention(getMentionQuery(nextValue, caret));
      setActiveIndex(0);
    },
    [enabled],
  );

  const close = useCallback(() => setMention(null), []);

  const apply = useCallback(
    (user: MentionUser) => {
      const textarea = textareaRef.current;
      if (!mention) return;
      const caret = textarea?.selectionStart ?? value.length;
      const next = insertMention(value, mention, caret, user.name, user.id);
      setMention(null);
      if (textarea) {
        applyTextChange(
          textarea,
          value,
          next.value,
          next.caret,
          next.caret,
          onChange,
        );
      } else {
        onChange(next.value);
      }
    },
    [mention, onChange, textareaRef, value],
  );

  /** Returns true when the key was consumed by the suggestion list. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!showSuggestions) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + suggestions.length) % suggestions.length,
        );
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const user = suggestions[activeIndex];
        if (user) apply(user);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return true;
      }
      return false;
    },
    [activeIndex, apply, close, showSuggestions, suggestions],
  );

  return {
    mention,
    suggestions,
    activeIndex,
    showSuggestions,
    sync,
    close,
    apply,
    setActiveIndex,
    handleKeyDown,
  };
}