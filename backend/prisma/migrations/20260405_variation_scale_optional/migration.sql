-- AlterTable: make scaleId optional and sku default empty
ALTER TABLE "product_variations" ALTER COLUMN "scale_id" DROP NOT NULL;
ALTER TABLE "product_variations" ALTER COLUMN "sku" SET DEFAULT '';

-- Drop the unique constraint that requires scaleId, re-create allowing nulls
-- (PostgreSQL treats NULL as distinct in unique constraints, so this still works)
