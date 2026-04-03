-- Add active/inactive status for revisit markers and filtering
ALTER TABLE "Revisit"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
