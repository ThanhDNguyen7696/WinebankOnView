import {
  getSupabaseClient,
  getVerifiedUser
} from "./supabase-client.js";

try {
  const supabase = getSupabaseClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
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

    document
      .getElementById("logoutButton")
      .addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.replace("./login.html");
      });
  }
} catch (error) {
  console.error("Member dashboard failed:", error);
  window.location.replace("./login.html");
}