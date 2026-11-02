-- Statement balances: the opening/closing figures printed inside an uploaded statement, so the
-- import can be checked against its own arithmetic. Additive and nullable, so existing imports
-- (and any running deployment) are unaffected.
ALTER TABLE "ReconciliationImport" ADD COLUMN "openingBalance" DECIMAL(14,2),
ADD COLUMN "closingBalance" DECIMAL(14,2);
