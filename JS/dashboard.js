import {
  supabase,
  isSupabaseConfigured,
  pageUrl,
  hasAdminAccess
} from "./supabase-client.js";

if (!isSupabaseConfigured) {
  window.location.replace("./login.html");
} else {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    window.location.replace("./login.html");
  } else {
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

    try {
      if (await hasAdminAccess(user)) {
        document.getElementById("adminDashboardLink").hidden = false;
      }
    } catch (adminCheckError) {
      console.error("Unable to verify admin access.", adminCheckError);
    }

    document.getElementById("logoutButton").addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.replace(pageUrl("./login.html"));
    });
  }
}
