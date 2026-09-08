import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH,
  PIZZA_MENU_PATH,
  hasSupabaseConfig
} from "./supabase-config.js";

const menuLink = document.getElementById("diningMenuLink");
const pizzaMenuLink = document.getElementById("pizzaMenuLink");

if (menuLink && hasSupabaseConfig()) {
  const publicMenuUrl = `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${MENU_PATH}`;
  menuLink.href = publicMenuUrl;
}

if (pizzaMenuLink && hasSupabaseConfig()) {
  const publicPizzaMenuUrl = `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${PIZZA_MENU_PATH}`;
  fetch(publicPizzaMenuUrl, { method: "HEAD", cache: "no-store" })
    .then((response) => {
      if (response.ok) pizzaMenuLink.href = publicPizzaMenuUrl;
    })
    .catch(() => {
      // Keep the legacy Pizza menu link until an admin publishes the first PDF.
    });
}
