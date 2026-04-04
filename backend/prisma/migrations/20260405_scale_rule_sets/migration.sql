-- CreateTable: scale_rule_sets
CREATE TABLE "scale_rule_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scale_rule_sets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scale_rule_sets_name_key" ON "scale_rule_sets"("name");

-- CreateTable: scale_rule_items
CREATE TABLE "scale_rule_items" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "percentageIncrease" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "scale_rule_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scale_rule_items_ruleSetId_scaleId_key" ON "scale_rule_items"("ruleSetId", "scaleId");

-- Foreign keys for scale_rule_items
ALTER TABLE "scale_rule_items" ADD CONSTRAINT "scale_rule_items_ruleSetId_fkey"
    FOREIGN KEY ("ruleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scale_rule_items" ADD CONSTRAINT "scale_rule_items_scaleId_fkey"
    FOREIGN KEY ("scaleId") REFERENCES "scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add scaleRuleSetId + noScales to products
ALTER TABLE "products" ADD COLUMN "scaleRuleSetId" TEXT;
ALTER TABLE "products" ADD COLUMN "noScales" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD CONSTRAINT "products_scaleRuleSetId_fkey"
    FOREIGN KEY ("scaleRuleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add scaleRuleSetId + noScales to tags
ALTER TABLE "tags" ADD COLUMN "scaleRuleSetId" TEXT;
ALTER TABLE "tags" ADD COLUMN "noScales" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tags" ADD CONSTRAINT "tags_scaleRuleSetId_fkey"
    FOREIGN KEY ("scaleRuleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add scaleRuleSetId to categories
ALTER TABLE "categories" ADD COLUMN "scaleRuleSetId" TEXT;
ALTER TABLE "categories" ADD CONSTRAINT "categories_scaleRuleSetId_fkey"
    FOREIGN KEY ("scaleRuleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
