export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const MENU_BUCKET = "menus";
export const MENU_PATH = "food/current-menu.pdf";

export function hasSupabaseConfig() {
  return !SUPABASE_URL.includes("YOUR_PROJECT") &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
}
