ALTER TYPE "RedesignStatus" ADD VALUE 'superseded';

ALTER TABLE "RedesignProposal" ADD COLUMN "previewUrl" TEXT;

ALTER TABLE "Attachment" ADD COLUMN "redesignProposalId" TEXT;

CREATE INDEX "Attachment_redesignProposalId_idx" ON "Attachment"("redesignProposalId");

ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_redesignProposalId_fkey"
FOREIGN KEY ("redesignProposalId") REFERENCES "RedesignProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
