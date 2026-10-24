-- Fractional reviewer awards. Existing whole-point rows convert exactly.
ALTER TABLE "PointEntry" ALTER COLUMN "points" SET DATA TYPE DECIMAL(16, 6);
