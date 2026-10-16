"use client";

import { useState, useTransition } from "react";
import { LocalTime } from "@/components/local-time";
import {
  MAX_COMMENT_DEPTH,
  truncateCommentBody,
  type CommentNode,
} from "@/lib/comments";
import { canDeleteComment, canEditComment } from "@/lib/comment-permissions";
import type { AppRole } from "@/lib/roles";
import { deleteCommentAction, updateCommentAction } from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { CommentBody, MentionText } from "@/components/comment-body";
import { CommentForm } from "@/components/comment-form";
import { MarkdownEditor } from "@/components/markdown-editor";
import { UserNameWithBadges } from "@/components/user-name-with-badges";

type UserOption = { id: string; name: string };

type ViewerProps = {
  currentUserId?: string;
  currentUserRole?: AppRole | null;
};

function CommentEditForm({
  comment,
  users,
  onDone,
}: {
  comment: CommentNode;
  users: UserOption[];
  onDone: () => void;
}) {
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unchanged = body.trim() === comment.body.trim();

  return (
    <form
      className="mt-2 space-y-2"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await updateCommentAction(comment.id, formData);
          if (result.error) setError(result.error);
          else onDone();
        });
      }}
    >
      <MarkdownEditor
        id={`edit-${comment.id}`}
        name="body"
        required
        rows={3}
        maxLength={2000}
        value={body}
        onChange={setBody}
        users={users}
        renderMentions={(text) => <MentionText text={text} users={users} />}
        aria-label="Edit comment"
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !body.trim() || unchanged}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  bugId,
  reporterId,
  users,
  currentUserId,
  currentUserRole,
}: {
  comment: CommentNode;
  bugId: string;
  reporterId: string;
  users: UserOption[];
} & ViewerProps) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isDeleted = Boolean(comment.deletedAt);
  const canReply = comment.depth < MAX_COMMENT_DEPTH && !isDeleted;
  const canEdit = canEditComment(currentUserId, comment);
  const canDelete = canDeleteComment(currentUserId, currentUserRole, comment);

  const handleDelete = () => {
    const own = comment.authorId === currentUserId;
    const confirmed = window.confirm(
      own
        ? "Delete your comment? Replies will stay, and the comment will show as deleted."
        : `Delete ${comment.author.name}'s comment? This is recorded in the activity log.`,
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCommentAction(comment.id);
      if (result.error) setError(result.error);
    });
  };

  return (
    <li id={`comment-${comment.id}`} className="scroll-mt-24 space-y-3">
      <article
        className={`rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 ${
          comment.depth > 0 ? "border-l-2 border-l-teal-600" : ""
        }`}
      >
        {isDeleted ? (
          <p className="text-sm italic text-slate-500">This comment was deleted.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-slate-500">
              <UserNameWithBadges
                name={comment.author.name}
                role={comment.author.role}
                showAuthor={comment.authorId === reporterId}
                className="font-medium text-slate-700"
              />
              <span className="inline-flex items-center gap-1.5">
                <a
                  href={`#comment-${comment.id}`}
                  className="hover:text-slate-700 hover:underline"
                >
                  <LocalTime date={comment.createdAt} />
                </a>
                {comment.editedAt ? (
                  <span title="This comment was edited">· edited</span>
                ) : null}
              </span>
            </div>

            {comment.parent ? (
              <p className="mt-2 rounded-md bg-white/80 px-2.5 py-1.5 text-xs text-slate-500 break-words">
                Replying to{" "}
                <span className="font-medium text-slate-700">
                  {comment.parent.author.name}
                </span>
                {": "}
                <span className="italic text-slate-600">
                  {comment.parent.deletedAt
                    ? "deleted comment"
                    : truncateCommentBody(comment.parent.body)}
                </span>
              </p>
            ) : null}

            {editing ? (
              <CommentEditForm
                comment={comment}
                users={users}
                onDone={() => setEditing(false)}
              />
            ) : (
              <CommentBody body={comment.body} users={users} />
            )}
          </>
        )}

        {!editing && (canReply || canEdit || canDelete) ? (
          <div className="mt-2">
            {replying ? (
              <CommentForm
                bugId={bugId}
                users={users}
                parentId={comment.id}
                parentAuthorName={comment.author.name}
                onCancel={() => setReplying(false)}
                onSuccess={() => setReplying(false)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                {canReply ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs text-teal-700 hover:text-teal-800"
                    onClick={() => setReplying(true)}
                  >
                    Reply
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    className="px-2 py-1 text-xs text-slate-600 hover:text-red-700"
                    onClick={handleDelete}
                  >
                    {pending ? "Deleting…" : "Delete"}
                  </Button>
                ) : null}
              </div>
            )}
            {error ? (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </article>

      {comment.children.length > 0 ? (
        <ul className="ml-2.5 space-y-3 border-l border-slate-200 pl-2.5 sm:ml-6 sm:pl-4">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              bugId={bugId}
              reporterId={reporterId}
              users={users}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentThread({
  bugId,
  reporterId,
  comments,
  users,
  currentUserId,
  currentUserRole,
}: {
  bugId: string;
  reporterId: string;
  comments: CommentNode[];
  users: UserOption[];
} & ViewerProps) {
  return (
    <div className="mt-4 space-y-6">
      {comments.length === 0 ? (
        <p className="text-sm text-slate-500">
          No comments yet. Add triage notes or reproduction steps below.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              bugId={bugId}
              reporterId={reporterId}
              users={users}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </ul>
      )}
      <CommentForm bugId={bugId} users={users} />
    </div>
  );
}
