CREATE TABLE "ScheduledAuditRun" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "auditId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ScheduledAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledAuditRun_scheduleId_runAt_idx" ON "ScheduledAuditRun"("scheduleId", "runAt");
CREATE INDEX "ScheduledAuditRun_targetUrl_userId_runAt_idx" ON "ScheduledAuditRun"("targetUrl", "userId", "runAt");

ALTER TABLE "ScoreAlertRule"
ADD COLUMN "deliveryChannel" TEXT NOT NULL DEFAULT 'webhook',
ADD COLUMN "deliveryTarget" TEXT;

ALTER TABLE "ScoreAlertEvent"
ADD COLUMN "deliveryChannel" TEXT,
ADD COLUMN "deliveryTarget" TEXT,
ADD COLUMN "deliveryStatus" TEXT,
ADD COLUMN "deliveryError" TEXT,
ADD COLUMN "deliveredAt" TIMESTAMP(3);
