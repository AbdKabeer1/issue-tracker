-- #150: let authors edit their comments and authors/admins delete them.
ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Logged when an admin removes someone else's comment.
ALTER TYPE "ActivityType" ADD VALUE 'comment_deleted';
