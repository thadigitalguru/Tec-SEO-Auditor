CREATE TABLE "ScoreAlertRule" (
    "id" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "dropPoints" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "ScoreAlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScoreAlertEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "previousAuditId" TEXT,
    "targetUrl" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricLabel" TEXT NOT NULL,
    "previousScore" INTEGER NOT NULL,
    "currentScore" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ScoreAlertEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScoreAlertRule_targetUrl_userId_idx" ON "ScoreAlertRule"("targetUrl", "userId");
CREATE INDEX "ScoreAlertRule_updatedAt_idx" ON "ScoreAlertRule"("updatedAt");
CREATE INDEX "ScoreAlertEvent_targetUrl_userId_createdAt_idx" ON "ScoreAlertEvent"("targetUrl", "userId", "createdAt");
CREATE INDEX "ScoreAlertEvent_ruleId_createdAt_idx" ON "ScoreAlertEvent"("ruleId", "createdAt");
