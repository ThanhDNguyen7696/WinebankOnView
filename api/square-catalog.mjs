// Reads the cellar wines from the Square Item Library so the website always
// matches what is on sale in Square. The access token stays on the server.
import { CELLAR_CATEGORIES, cellarGroupResolver, itemPrice, json, squareAccount, squareFetch } from "./_square.mjs";

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

function toCellarItems(objects) {
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
        ...itemPrice(itemData)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  const account = squareAccount("catalog");
  if (!account.token) {
    console.error("SQUARE_ACCESS_TOKEN is not configured.");
    return json({ error: "The Square catalogue is not configured." }, 503);
  }

  try {
    const items = toCellarItems(await listCatalogObjects(account));
    // Cache at the edge: refresh from Square every 5 minutes in the background,
    // so visitors never wait for the full catalogue download.
    return json({ items }, 200, { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" });
  } catch (error) {
    console.error("Unable to load the Square catalogue:", error);
    return json({ error: "Unable to load the cellar from Square." }, 502);
  }
}
