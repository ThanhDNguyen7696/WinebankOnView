// Shared Square helpers for the api/ functions. Files starting with "_" are
// not deployed as endpoints by Vercel.
const SQUARE_VERSION = "2025-01-23";

// The Cellar shows the wines filed under this Square category tree, e.g.
// Online Store > White Bottle > Chardonnay.
export const ONLINE_STORE_CATEGORY = "Online Store";

// Square category name (directly under Online Store) -> filter key used by cellar.html.
export const CELLAR_CATEGORIES = {
  "magnums": "Magnums",
  "red-bottle": "Red Bottle",
  "vault-wines": "Vault Wines",
  "dessert": "Dessert",
  "white-bottle": "White Bottle",
  "champagne-sparkling": "Champagne & Sparkling"
};

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
});

const slugify = (value) => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

// The catalogue always comes from SQUARE_ACCESS_TOKEN. Checkout can be pointed
// at a separate (sandbox) account with the SQUARE_CHECKOUT_* variables for testing.
export function squareAccount(purpose = "catalog") {
  const checkoutToken = purpose === "checkout" && process.env.SQUARE_CHECKOUT_ACCESS_TOKEN;
  return {
    token: checkoutToken || process.env.SQUARE_ACCESS_TOKEN,
    environment: (checkoutToken ? process.env.SQUARE_CHECKOUT_ENVIRONMENT : process.env.SQUARE_ENVIRONMENT) || "production"
  };
}

export async function squareFetch(account, path, { method = "GET", body, query } = {}) {
  const baseUrl = account.environment === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${account.token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.errors?.map((item) => item.detail).join(" ") || `Square responded with ${response.status}`);
    error.status = response.status;
    error.squareErrors = result.errors;
    throw error;
  }
  return result;
}

// Returns a function that maps a category id to its cellar filter key (or null)
// by walking up to the category directly under Online Store.
export function cellarGroupResolver(categories) {
  return function cellarGroup(categoryId) {
    let previous = null;
    let current = categoryId;
    for (let depth = 0; current && depth < 10; depth += 1) {
      const category = categories.get(current);
      if (!category) return null;
      if (category.name === ONLINE_STORE_CATEGORY && !category.parent_category?.id) {
        const key = slugify(categories.get(previous)?.name);
        return CELLAR_CATEGORIES[key] ? key : null;
      }
      previous = current;
      current = category.parent_category?.id;
    }
    return null;
  };
}

// The variation the website sells for an item (checkout uses the same one).
export function sellableVariation(itemData) {
  return (itemData.variations || []).find((variation) => !variation.is_deleted) || null;
}

export function tracksInventory(variation) {
  const data = variation?.item_variation_data || {};
  return Boolean(data.track_inventory || (data.location_overrides || []).some((override) => override.track_inventory));
}

// Returns Map<variationId, quantity in stock> for the given variations. Only
// counts at SQUARE_LOCATION_ID when it is set; otherwise sums all locations.
export async function inventoryCounts(account, variationIds) {
  const quantities = new Map(variationIds.map((id) => [id, 0]));
  const locationId = process.env.SQUARE_LOCATION_ID;

  for (let start = 0; start < variationIds.length; start += 1000) {
    let cursor;
    do {
      const page = await squareFetch(account, "/v2/inventory/counts/batch-retrieve", {
        method: "POST",
        body: {
          catalog_object_ids: variationIds.slice(start, start + 1000),
          location_ids: locationId ? [locationId] : undefined,
          states: ["IN_STOCK"],
          cursor
        }
      });
      for (const count of page.counts || []) {
        quantities.set(count.catalog_object_id, (quantities.get(count.catalog_object_id) || 0) + Number(count.quantity || 0));
      }
      cursor = page.cursor;
    } while (cursor);
  }

  return quantities;
}

export function itemPrice(itemData) {
  const amounts = (itemData.variations || [])
    .filter((variation) => !variation.is_deleted)
    .map((variation) => variation.item_variation_data?.price_money?.amount)
    .filter((amount) => Number.isFinite(amount));

  if (!amounts.length) return { price: null, priceFrom: false };
  const lowest = Math.min(...amounts);
  return { price: lowest / 100, priceFrom: new Set(amounts).size > 1 };
}
