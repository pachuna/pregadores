-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANCIAO', 'PUBLICADOR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "congregation" TEXT,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PUBLICADOR';
