-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CongregationJoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "congregationId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CongregationJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CongregationJoinRequest_userId_congregationId_key" ON "CongregationJoinRequest"("userId", "congregationId");

-- CreateIndex
CREATE INDEX "CongregationJoinRequest_congregationId_status_idx" ON "CongregationJoinRequest"("congregationId", "status");

-- CreateIndex
CREATE INDEX "CongregationJoinRequest_userId_idx" ON "CongregationJoinRequest"("userId");

-- AddForeignKey
ALTER TABLE "CongregationJoinRequest" ADD CONSTRAINT "CongregationJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CongregationJoinRequest" ADD CONSTRAINT "CongregationJoinRequest_congregationId_fkey" FOREIGN KEY ("congregationId") REFERENCES "Congregation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
