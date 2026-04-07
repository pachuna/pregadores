-- AlterEnum
ALTER TYPE "CongregationStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Congregation" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "PioneerReport" ALTER COLUMN "goalHours" SET DEFAULT 2;
