-- Additive repair for 20261022000000_redesign_mockups_and_choice.
-- ADD VALUE cannot share a transaction with the column repair.

ALTER TYPE "RedesignStatus" ADD VALUE IF NOT EXISTS 'superseded';
