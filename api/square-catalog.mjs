// Reads the cellar wines from the Square Item Library so the website always
// matches what is on sale in Square. The access token stays on the server.
import { CELLAR_CATEGORIES, cellarGroupResolver, inventoryCounts, itemPrice, json, sellableVariation, squareAccount, squareFetch, tracksInventory } from "./_square.mjs";

async function listCatalogObjects(account) {
  const objects = [];
  let cursor = "";

  do {
    const query = { types: "ITEM,CATEGORY,IMAGE" };
    if (cursor) query.cursor = cursor;
    const page = await squareFetch(account, "/v2/catalog/list", { query });
    objects.push(...(page.objects || []));
    cursor = page.cursor || "";
  } while (cursor);

  return objects;
}

// stock is the quantity on hand in Square, or null when Square does not track it.
function toCellarItems(objects, quantities) {
  const categories = new Map();
  const imageUrls = new Map();

  for (const object of objects) {
    if (object.type === "CATEGORY") categories.set(object.id, object.category_data || {});
    if (object.type === "IMAGE" && object.image_data?.url) imageUrls.set(object.id, object.image_data.url);
  }

  const cellarGroup = cellarGroupResolver(categories);

  return objects
    .filter((object) => object.type === "ITEM" && !object.is_deleted && !object.item_data?.is_archived)
    .map((object) => {
      const itemData = object.item_data;
      const placements = (itemData.categories || [])
        .map(({ id }) => ({ id, group: cellarGroup(id) }))
        .filter((placement) => placement.group);
      if (!placements.length) return null;

      const { id: categoryId, group } = placements[0];
      const subcategory = categories.get(categoryId)?.name;

      return {
        id: object.id,
        name: itemData.name,
        description: itemData.description_plaintext || itemData.description || "",
        category: group,
        categoryLabel: CELLAR_CATEGORIES[group],
        subcategory: subcategory && subcategory !== CELLAR_CATEGORIES[group] ? subcategory : "",
        vintage: itemData.name?.match(/\b(19|20)\d{2}\b/)?.[0] || "NV",
        imageUrl: (itemData.image_ids || []).map((id) => imageUrls.get(id)).find(Boolean) || "",
        stock: stockFor(sellableVariation(itemData), quantities),
        ...itemPrice(itemData)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function stockFor(variation, quantities) {
  if (!variation || !tracksInventory(variation)) return null;
  return Math.max(0, Math.floor(quantities.get(variation.id) || 0));
}

// Inventory is only needed for the variations of items that sit in the cellar.
function trackedVariationIds(objects) {
  return objects
    .filter((object) => object.type === "ITEM" && !object.is_deleted)
    .map((object) => sellableVariation(object.item_data || {}))
    .filter((variation) => variation && tracksInventory(variation))
    .map((variation) => variation.id);
}

export async function GET() {
  const account = squareAccount("catalog");
  if (!account.token) {
    console.error("SQUARE_ACCESS_TOKEN is not configured.");
    return json({ error: "The Square catalogue is not configured." }, 503);
  }

  try {
    const objects = await listCatalogObjects(account);
    const draft = toCellarItems(objects, new Map());
    const cellarIds = new Set(draft.map((item) => item.id));
    // Still list the wines if inventory is unavailable; checkout re-checks stock.
    const quantities = await inventoryCounts(account, trackedVariationIds(objects.filter((object) => cellarIds.has(object.id))))
      .catch((error) => { console.error("Unable to load Square inventory:", error); return null; });
    const items = quantities ? toCellarItems(objects, quantities) : draft.map((item) => ({ ...item, stock: null }));
    // Only Vercel's edge caches the list (refreshed from Square every 5 minutes
    // in the background); browsers always ask the edge, so stock is never a
    // previous visit's copy.
    return json({ items }, 200, {
      "Cache-Control": "no-cache",
      "Vercel-CDN-Cache-Control": "max-age=300, stale-while-revalidate=86400"
    });
  } catch (error) {
    console.error("Unable to load the Square catalogue:", error);
    return json({ error: "Unable to load the cellar from Square." }, 502);
  }
}
