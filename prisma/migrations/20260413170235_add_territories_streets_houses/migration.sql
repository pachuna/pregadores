/*
  Warnings:

  - A unique constraint covering the columns `[firebaseUid]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "HouseVisitStatus" AS ENUM ('OK', 'FAIL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firebaseUid" TEXT;

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "firebaseId" TEXT,
    "number" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#cccccc',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdate" TIMESTAMP(3),
    "congregationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Street" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUpdate" TIMESTAMP(3),
    "territoryId" TEXT NOT NULL,

    CONSTRAINT "Street_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "observation" TEXT,
    "phones" JSONB NOT NULL DEFAULT '[]',
    "streetId" TEXT NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseVisit" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "status" "HouseVisitStatus" NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "firebaseUserUid" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Territory_firebaseId_key" ON "Territory"("firebaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_number_key" ON "Territory"("number");

-- CreateIndex
CREATE INDEX "Territory_congregationId_idx" ON "Territory"("congregationId");

-- CreateIndex
CREATE INDEX "Street_territoryId_idx" ON "Street"("territoryId");

-- CreateIndex
CREATE INDEX "House_streetId_idx" ON "House"("streetId");

-- CreateIndex
CREATE INDEX "HouseVisit_houseId_idx" ON "HouseVisit"("houseId");

-- CreateIndex
CREATE INDEX "HouseVisit_userId_idx" ON "HouseVisit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_congregationId_fkey" FOREIGN KEY ("congregationId") REFERENCES "Congregation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Street" ADD CONSTRAINT "Street_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "Street"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseVisit" ADD CONSTRAINT "HouseVisit_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseVisit" ADD CONSTRAINT "HouseVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
