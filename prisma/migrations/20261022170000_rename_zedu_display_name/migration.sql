-- The product is Ziki. The first organization and its project were created
-- with the display name Zedu. Rename those when they are still the originals.
-- The slug stays "zedu", so existing links keep working. A name someone
-- already changed is left alone.

UPDATE "Tenant"
SET "name" = 'Ziki', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'zedu' AND "name" = 'Zedu';

UPDATE "Project" AS p
SET "name" = 'Ziki', "updatedAt" = CURRENT_TIMESTAMP
FROM "Tenant" AS t
WHERE p."tenantId" = t."id"
  AND t."slug" = 'zedu'
  AND p."slug" = 'zedu'
  AND p."name" = 'Zedu';
