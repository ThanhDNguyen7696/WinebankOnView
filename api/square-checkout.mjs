// Creates a Square payment link for the Cellar bag (pickup in store).
// Prices always come from the Square catalogue, never from the browser, and the
// member discount (set by admins in Supabase shop_settings) is only added after
// the membership is checked in Supabase.
import { cellarGroupResolver, inventoryCounts, json, sellableVariation, squareAccount, squareFetch, tracksInventory } from "./_square.mjs";

const MAX_LINES = 50;
const MAX_QUANTITY = 99;

const clean = (value, limit) => String(value ?? "").trim().slice(0, limit);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Fetches the requested items plus every ancestor category, so we can confirm
// each one really sits under Online Store.
async function loadCellarItems(account, itemIds) {
  const { objects = [], related_objects: related = [] } = await squareFetch(account, "/v2/catalog/batch-retrieve", {
    method: "POST",
    body: { object_ids: itemIds, include_related_objects: true }
  });

  // related_objects only carries the reporting category, so fetch the item's
  // other categories and their parents ourselves.
  const categories = new Map(related.filter((object) => object.type === "CATEGORY").map((object) => [object.id, object.category_data || {}]));
  const itemCategoryIds = objects.flatMap((object) => (object.item_data?.categories || []).map(({ id }) => id));
  for (let depth = 0; depth < 5; depth += 1) {
    const missing = [...new Set([
      ...itemCategoryIds,
      ...[...categories.values()].map((category) => category.parent_category?.id)
    ].filter((id) => id && !categories.has(id)))];
    if (!missing.length) break;
    const parents = await squareFetch(account, "/v2/catalog/batch-retrieve", {
      method: "POST",
      body: { object_ids: missing }
    });
    for (const object of parents.objects || []) categories.set(object.id, object.category_data || {});
  }

  const cellarGroup = cellarGroupResolver(categories);
  return new Map(objects
    .filter((object) => object.type === "ITEM" && !object.is_deleted && !object.item_data?.is_archived)
    .filter((object) => (object.item_data.categories || []).some(({ id }) => cellarGroup(id)))
    .map((object) => [object.id, object]));
}

// Returns the signed-in member's details when their membership is active, else null.
async function activeMember(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!token || !supabaseUrl || !anonKey) return null;

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();

  const membershipUrl = new URL("/rest/v1/memberships", supabaseUrl);
  membershipUrl.searchParams.set("select", "status,expiry_date");
  membershipUrl.searchParams.set("user_id", `eq.${user.id}`);
  const membershipResponse = await fetch(membershipUrl, { headers });
  if (!membershipResponse.ok) return null;
  const [membership] = await membershipResponse.json();

  const today = new Date().toISOString().slice(0, 10);
  const active = membership?.status === "active" && (!membership.expiry_date || membership.expiry_date >= today);
  return active ? user : null;
}

// Reads the admin-controlled discount. Throws if it cannot be read so a member
// is never charged a different price than the Checkout page showed.
async function memberDiscountPercent() {
  const { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: anonKey } = process.env;
  const url = new URL("/rest/v1/shop_settings", supabaseUrl);
  url.searchParams.set("select", "member_discount_percent");
  url.searchParams.set("id", "eq.1");
  const response = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  const [settings] = response.ok ? await response.json() : [];
  const percent = Number(settings?.member_discount_percent);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error("The member discount setting could not be read from Supabase.");
  }
  return percent;
}

async function locationId(account) {
  const configured = process.env.SQUARE_CHECKOUT_ACCESS_TOKEN
    ? process.env.SQUARE_CHECKOUT_LOCATION_ID
    : process.env.SQUARE_LOCATION_ID;
  if (configured) return configured;

  // Fall back to the account's only active location.
  const { locations = [] } = await squareFetch(account, "/v2/locations");
  const active = locations.filter((location) => location.status === "ACTIVE");
  if (active.length !== 1) throw new Error("Set SQUARE_LOCATION_ID: the Square account has more than one active location.");
  return active[0].id;
}

export async function POST(request) {
  const catalogAccount = squareAccount("catalog");
  const checkoutAccount = squareAccount("checkout");
  if (!catalogAccount.token || !checkoutAccount.token) {
    return json({ error: "Online checkout is not configured yet." }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const phone = clean(payload.phone, 30);
  if (!name || !validEmail(email)) {
    return json({ error: "Please enter your name and a valid email address for pickup." }, 400);
  }

  const quantities = new Map();
  for (const line of Array.isArray(payload.items) ? payload.items : []) {
    const id = clean(line?.id, 64);
    const qty = Math.floor(Number(line?.qty));
    if (id && qty > 0) quantities.set(id, Math.min((quantities.get(id) || 0) + qty, MAX_QUANTITY));
  }
  if (!quantities.size || quantities.size > MAX_LINES) {
    return json({ error: "Your bag is empty." }, 400);
  }

  try {
    const items = await loadCellarItems(catalogAccount, [...quantities.keys()]);
    const unavailable = [...quantities.keys()].filter((id) => !items.has(id));
    if (unavailable.length) {
      return json({ error: "Some wines in your bag are no longer available. Please refresh the page.", unavailable }, 409);
    }

    // Never sell more bottles than Square has in stock.
    const tracked = [...quantities.keys()]
      .map((id) => ({ id, variation: sellableVariation(items.get(id).item_data) }))
      .filter(({ variation }) => tracksInventory(variation));
    const stock = await inventoryCounts(catalogAccount, tracked.map(({ variation }) => variation.id));
    const short = tracked
      .filter(({ id, variation }) => quantities.get(id) > Math.max(0, Math.floor(stock.get(variation.id) || 0)))
      .map(({ id, variation }) => ({ id, name: items.get(id).item_data.name, available: Math.max(0, Math.floor(stock.get(variation.id) || 0)) }));
    if (short.length) {
      const names = short.map((line) => `${line.name} (${line.available ? `only ${line.available} left` : "sold out"})`).join(", ");
      return json({ error: `Not enough stock: ${names}. Please update your bag.`, stock: short }, 409);
    }

    // When checkout runs against a separate sandbox account, the production
    // catalogue ids do not exist there, so send named lines with the real price.
    const sameAccount = checkoutAccount.token === catalogAccount.token;
    const lineItems = [...quantities].map(([id, qty]) => {
      const item = items.get(id);
      const variation = sellableVariation(item.item_data);
      return sameAccount
        ? { catalog_object_id: variation.id, quantity: String(qty) }
        : { name: item.item_data.name, quantity: String(qty), base_price_money: variation.item_variation_data.price_money };
    });

    const member = await activeMember(request);
    const discountPercent = member ? await memberDiscountPercent() : 0;
    const origin = new URL(request.url).origin;
    const pickupNote = phone ? `Phone: ${phone}` : undefined;

    const { payment_link: link } = await squareFetch(checkoutAccount, "/v2/online-checkout/payment-links", {
      method: "POST",
      body: {
        idempotency_key: crypto.randomUUID(),
        description: "WineBank Cellar order",
        order: {
          location_id: await locationId(checkoutAccount),
          line_items: lineItems,
          discounts: discountPercent
            ? [{ uid: "member-discount", name: `Member discount (${discountPercent}%)`, percentage: String(discountPercent), scope: "ORDER" }]
            : undefined,
          fulfillments: [{
            type: "PICKUP",
            state: "PROPOSED",
            pickup_details: {
              recipient: { display_name: name, email_address: email },
              schedule_type: "ASAP",
              note: pickupNote
            }
          }]
        },
        checkout_options: {
          redirect_url: `${origin}/checkout-success.html`,
          ask_for_shipping_address: false
        }
        // No pre_populated_data: Square rejects buyer_email alongside a fulfillment,
        // and the pickup recipient above already carries the email.
      }
    });

    return json({ url: link.url, memberDiscountPercent: discountPercent });
  } catch (error) {
    console.error("Unable to create the Square checkout:", error);
    return json({ error: "Checkout is temporarily unavailable. Please try again or call (03) 5444 4655." }, 502);
  }
}
