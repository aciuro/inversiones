CREATE TABLE "PendingChange" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeApproval" (
    "id" TEXT NOT NULL,
    "pendingChangeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeApproval_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChangeApproval" ADD CONSTRAINT "ChangeApproval_pendingChangeId_userId_key" UNIQUE ("pendingChangeId", "userId");

ALTER TABLE "PendingChange" ADD CONSTRAINT "PendingChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingChange" ADD CONSTRAINT "PendingChange_proposedBy_fkey" FOREIGN KEY ("proposedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeApproval" ADD CONSTRAINT "ChangeApproval_pendingChangeId_fkey" FOREIGN KEY ("pendingChangeId") REFERENCES "PendingChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeApproval" ADD CONSTRAINT "ChangeApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
