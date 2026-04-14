-- AlterEnum: adiciona SERVO_DE_CAMPO ao Role
ALTER TYPE "Role" ADD VALUE 'SERVO_DE_CAMPO';

-- CreateEnum: TerritoryType
CREATE TYPE "TerritoryType" AS ENUM ('IMAGE', 'STREETS');

-- AlterTable: Territory — adiciona label, territoryType, imageUrl
ALTER TABLE "Territory" ADD COLUMN "label" TEXT;
ALTER TABLE "Territory" ADD COLUMN "territoryType" "TerritoryType" NOT NULL DEFAULT 'STREETS';
ALTER TABLE "Territory" ADD COLUMN "imageUrl" TEXT;
