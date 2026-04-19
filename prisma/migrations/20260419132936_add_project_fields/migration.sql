-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "amountUSD" DOUBLE PRECISION,
ADD COLUMN     "paidByUserId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "developer" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "soldAt" TIMESTAMP(3),
ADD COLUMN     "soldPrice" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "totalPrice" DOUBLE PRECISION,
ADD COLUMN     "unitNumber" TEXT;

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "Reinforcement" ADD COLUMN     "amountUSD" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
