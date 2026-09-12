-- Retire price-group configuration. Saved sales and wholesale line prices remain intact.
BEGIN;
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "priceGroupId";
DROP TABLE IF EXISTS "PriceGroupProductOverride";
DROP TABLE IF EXISTS "PriceGroup";
COMMIT;
