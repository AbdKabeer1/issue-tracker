"use client";

import { useRef, useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { MentionText } from "@/components/comment-body";

type UserOption = { id: string; name: string };

type CommentFormProps = {
  bugId: string;
  users: UserOption[];
  parentId?: string;
  parentAuthorName?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function CommentForm({
  bugId,
  users,
  parentId,
  parentAuthorName,
  onCancel,
  onSuccess,
}: CommentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isReply = Boolean(parentId);

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
            formRef.current?.reset();
            onSuccess?.();
          }
        });
      }}
    >
      {parentId ? (
        <input type="hidden" name="parentId" value={parentId} />
      ) : null}
      <label
        htmlFor={parentId ? `body-${parentId}` : "body"}
        className="block text-sm font-medium text-slate-700"
      >
        {isReply
          ? `Reply to ${parentAuthorName ?? "comment"}`
          : "Add a comment"}
      </label>
      <MarkdownEditor
        ref={editorRef}
        id={parentId ? `body-${parentId}` : "body"}
        name="body"
        required
        rows={isReply ? 3 : 4}
        maxLength={2000}
        value={body}
        onChange={setBody}
        users={users}
        renderMentions={(text) => <MentionText text={text} users={users} />}
        placeholder={
          isReply
            ? "Write your reply… Type @ to mention someone"
            : "Share triage notes… Type @ to mention someone"
        }
        footer={
          !isReply ? (
            <p className="text-xs text-slate-500">
              Markdown is supported. People you @mention get an email (they
              can turn these off in Settings).
            </p>
          ) : null
        }
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending
            ? isReply
              ? "Replying…"
              : "Posting…"
            : isReply
              ? "Post reply"
              : "Post comment"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}