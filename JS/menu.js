import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH,
  hasSupabaseConfig
} from "./supabase-config.js";

const menuLink = document.getElementById("diningMenuLink");

if (menuLink && hasSupabaseConfig()) {
  const publicMenuUrl = `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${MENU_PATH}?v=${Date.now()}`;
  menuLink.href = publicMenuUrl;
  menuLink.target = "_blank";
  menuLink.rel = "noopener";
}
