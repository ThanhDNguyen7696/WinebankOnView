import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabaseConfig } from "./supabase-config.js";

const navCta = document.querySelector(".nav-cta");

if (navCta && hasSupabaseConfig()) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const user = session.user;
    const metadata = user.user_metadata || {};
    const displayName = metadata.first_name || (user.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    navCta.textContent = displayName;
    navCta.href = "./member-dashboard.html";
  }
}
