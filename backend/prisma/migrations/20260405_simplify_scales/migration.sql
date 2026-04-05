-- Simplify scales: remove Scale table, ScaleRuleItem gets own name field

-- 1. Add new columns to scale_rule_items
ALTER TABLE "scale_rule_items" ADD COLUMN "name" TEXT;
ALTER TABLE "scale_rule_items" ADD COLUMN "sortOrder" INT NOT NULL DEFAULT 0;

-- 2. Migrate data: copy scale name into scale_rule_items
UPDATE "scale_rule_items" SET "name" = s."name"
FROM "scales" s WHERE "scale_rule_items"."scaleId" = s."id";

-- 3. Set name NOT NULL (all rows should have a name now)
-- For any orphans, set a default
UPDATE "scale_rule_items" SET "name" = 'Unknown' WHERE "name" IS NULL;
ALTER TABLE "scale_rule_items" ALTER COLUMN "name" SET NOT NULL;

-- 4. Drop old FK and column from scale_rule_items
ALTER TABLE "scale_rule_items" DROP CONSTRAINT IF EXISTS "scale_rule_items_scaleId_fkey";
DROP INDEX IF EXISTS "scale_rule_items_ruleSetId_scaleId_key";
ALTER TABLE "scale_rule_items" DROP COLUMN "scaleId";

-- 5. Add new unique constraint (ruleSetId + name)
CREATE UNIQUE INDEX "scale_rule_items_ruleSetId_name_key" ON "scale_rule_items"("ruleSetId", "name");

-- 6. Drop scaleId from product_variations
ALTER TABLE "product_variations" DROP CONSTRAINT IF EXISTS "product_variations_scaleId_fkey";
DROP INDEX IF EXISTS "product_variations_productId_scaleId_key";
DROP INDEX IF EXISTS "product_variations_scaleId_idx";
ALTER TABLE "product_variations" DROP COLUMN IF EXISTS "scaleId";

-- 7. Drop legacy tables
DROP TABLE IF EXISTS "scale_rules" CASCADE;
DROP TABLE IF EXISTS "scales" CASCADE;
