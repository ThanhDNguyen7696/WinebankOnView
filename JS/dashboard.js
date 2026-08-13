import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

if (!hasSupabaseConfig()) {
  window.location.replace("./login.html");
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace("./login.html");
  } else {
    const user = session.user;
    const metadata = user.user_metadata || {};
    const emailName = (user.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    document.getElementById("memberName").textContent =
      metadata.first_name || emailName || "Member";
    document.getElementById("memberEmail").textContent =
      user.email || "Not provided";
    document.getElementById("memberPhone").textContent =
      metadata.phone || user.phone || "Not provided";
    document.getElementById("membershipStatus").textContent =
      metadata.membership_status || "Pending";

    document.getElementById("logoutButton").addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.replace("./login.html");
    });
  }
}
