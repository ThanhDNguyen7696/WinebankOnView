import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH,
  PIZZA_MENU_PATH,
  SPECIAL_MENU_PATH,
  GLASS_MENU_PATH,
  BOTTLE_MENU_PATH,
  FUNCTION_BROCHURE_PATH,
  hasSupabaseConfig
} from "./supabase-config.js";
import { supabase } from "./supabase-client.js";

const menus = [
  { key: "dining", link: document.getElementById("diningMenuLink"), path: MENU_PATH },
  { key: "pizza", link: document.getElementById("pizzaMenuLink"), path: PIZZA_MENU_PATH },
  { key: "special", link: document.getElementById("specialMenuLink"), path: SPECIAL_MENU_PATH },
  { key: "glass", link: document.getElementById("glassMenuLink"), path: GLASS_MENU_PATH },
  { key: "bottle", link: document.getElementById("bottleMenuLink"), path: BOTTLE_MENU_PATH },
  { key: "functions", link: document.getElementById("functionBrochureLink"), path: FUNCTION_BROCHURE_PATH }
];

const publicMenuUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${path}`;

async function usePublishedMenu(menu) {
  if (!menu.link) return;
  const url = publicMenuUrl(menu.path);
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (response.ok) menu.link.href = url;
  } catch {
    // Keep the bundled or legacy fallback until an admin publishes this PDF.
  }
}

async function applyMenuVisibility() {
  const { data, error } = await supabase
    .from("menu_settings")
    .select("menu_key, is_visible");

  if (error) {
    console.warn("Unable to load menu visibility. All available menus remain visible.", error);
    return;
  }

  const visibility = new Map((data || []).map((item) => [item.menu_key, item.is_visible]));
  menus.forEach((menu) => {
    if (menu.link) menu.link.hidden = visibility.get(menu.key) === false;
  });
}

if (hasSupabaseConfig()) {
  await Promise.all(menus.map(usePublishedMenu));
  await applyMenuVisibility();
}
