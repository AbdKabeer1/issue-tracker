-- Issue templates (#307): Markdown that pre-fills the report description
-- for issues of this type. NULL means no template, as before.
ALTER TABLE "IssueType" ADD COLUMN "template" TEXT;

-- Start existing installs with the default bug template on "Fix", the type
-- the report form selects by default. Only if nobody has set one.
UPDATE "IssueType"
SET "template" = $tmpl$### Steps to reproduce
1.
2.
3.

### Expected

### Actual

### Environment
- Browser / app version:
- Device and OS:
$tmpl$
WHERE "name" = 'Fix' AND "template" IS NULL;
