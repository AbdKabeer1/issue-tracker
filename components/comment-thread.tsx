"use client";

import { useState } from "react";
import { LocalTime } from "@/components/local-time";
import {
  MAX_COMMENT_DEPTH,
  truncateCommentBody,
  type CommentNode,
} from "@/lib/comments";
import { Button } from "@/components/ui/button";
import { CommentBody } from "@/components/comment-body";
import { CommentForm } from "@/components/comment-form";
import { UserNameWithBadges } from "@/components/user-name-with-badges";

type UserOption = { id: string; name: string };

function CommentItem({
  comment,
  bugId,
  reporterId,
  users,
}: {
  comment: CommentNode;
  bugId: string;
  reporterId: string;
  users: UserOption[];
}) {
  const [replying, setReplying] = useState(false);
  const canReply = comment.depth < MAX_COMMENT_DEPTH;

  return (
    <li className="space-y-3">
      <article
        className={`rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 ${
          comment.depth > 0 ? "border-l-2 border-l-teal-600" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-slate-500">
          <UserNameWithBadges
            name={comment.author.name}
            role={comment.author.role}
            showAuthor={comment.authorId === reporterId}
            className="font-medium text-slate-700"
          />
          <LocalTime date={comment.createdAt} />
        </div>

        {comment.parent ? (
          <p className="mt-2 rounded-md bg-white/80 px-2.5 py-1.5 text-xs text-slate-500 break-words">
            Replying to{" "}
            <span className="font-medium text-slate-700">
              {comment.parent.author.name}
            </span>
            {": "}
            <span className="italic text-slate-600">
              {truncateCommentBody(comment.parent.body)}
            </span>
          </p>
        ) : null}

        <CommentBody body={comment.body} users={users} />

        {canReply ? (
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
              <Button
                type="button"
                variant="ghost"
                className="px-2 py-1 text-xs text-teal-700 hover:text-teal-800"
                onClick={() => setReplying(true)}
              >
                Reply
              </Button>
            )}
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
}: {
  bugId: string;
  reporterId: string;
  comments: CommentNode[];
  users: UserOption[];
}) {
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
            />
          ))}
        </ul>
      )}
      <CommentForm bugId={bugId} users={users} />
    </div>
  );
}
