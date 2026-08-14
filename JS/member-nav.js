import {
  getSupabaseClient,
  checkAdminAccess,
  withTimeout
} from "./supabase-client.js";

const navCta = document.querySelector(".nav-cta");

if (navCta) {
  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await withTimeout(
      supabase.auth.getSession(),
      7000,
      "Navigation session check"
    );

    if (session?.user) {
      const user = session.user;

      // Preserve the admin's route across all public pages. The session remains
      // active while browsing Food/Home/Cellar, so an authorised administrator
      // can always return to the private dashboard without signing in again.
      let isAdmin = false;
      try {
        const result = await checkAdminAccess(supabase, user.id);
        isAdmin = result.isAdmin;
      } catch (adminError) {
        // A role lookup failure must never break the public navigation.
        console.warn("WineBank admin navigation check skipped:", adminError);
      }

      if (isAdmin) {
        navCta.textContent = "Admin Dashboard";
        navCta.href = "./admin.html";
        navCta.setAttribute("aria-label", "Return to WineBank admin dashboard");
      } else {
        const metadata = user.user_metadata || {};
        const displayName = metadata.first_name || (user.email || "")
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());

        navCta.textContent = displayName || "My account";
        navCta.href = "./member-dashboard.html";
        navCta.setAttribute("aria-label", "Open member account");
      }
    } else {
      navCta.textContent = "Member Login";
      navCta.href = "./login.html";
      navCta.removeAttribute("aria-label");
    }
  } catch (error) {
    // Navigation must never block the page if Supabase is temporarily unavailable.
    console.warn("WineBank navigation session check skipped:", error);
  }
}
