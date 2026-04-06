-- CreateTable
CREATE TABLE "PioneerReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "creditHours" INTEGER NOT NULL DEFAULT 0,
    "bibleStudies" INTEGER NOT NULL DEFAULT 0,
    "goalHours" INTEGER NOT NULL DEFAULT 4,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PioneerReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PioneerReport_userId_date_key" ON "PioneerReport"("userId", "date");

-- CreateIndex
CREATE INDEX "PioneerReport_userId_idx" ON "PioneerReport"("userId");

-- AddForeignKey
ALTER TABLE "PioneerReport" ADD CONSTRAINT "PioneerReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
