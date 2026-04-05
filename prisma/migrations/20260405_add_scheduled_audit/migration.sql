CREATE TABLE "ScheduledAudit" (
    "id" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "cadenceDays" INTEGER NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastAuditId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "ScheduledAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledAudit_nextRunAt_idx" ON "ScheduledAudit"("nextRunAt");
CREATE INDEX "ScheduledAudit_targetUrl_userId_idx" ON "ScheduledAudit"("targetUrl", "userId");
