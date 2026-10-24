-- #659: avoid notifying a contributor on every validation or daily sweep.
-- The owner receives a single notice when the agent reaches reviewer eligibility.
ALTER TABLE "Agent"
ADD COLUMN "reviewerEligibilityNotifiedAt" TIMESTAMP(3);
