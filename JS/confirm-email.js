import { setStatus } from "./common.js";
import { supabase, isSupabaseConfigured, pageUrl, authErrorMessage } from "./supabase-client.js";

const button = document.getElementById("confirmButton");
const params = new URLSearchParams(window.location.search);
const tokenHash = params.get("token_hash");
const type = params.get("type") || "signup";

if (!isSupabaseConfigured) {
  setStatus("confirmStatus", "Email confirmation is being configured. Please try again later.", "error");
  button.disabled = true;
} else if (!tokenHash) {
  setStatus("confirmStatus", "This confirmation link is missing required information. Request a new one and try again.", "error");
  button.disabled = true;
} else {
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Confirming…";

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      button.disabled = false;
      button.textContent = "Confirm my email";
      setStatus("confirmStatus", authErrorMessage(error, "Unable to confirm the email."), "error");
      return;
    }

    setStatus("confirmStatus", "Confirmed. Redirecting…", "success");
    window.setTimeout(() => {
      window.location.replace(type === "recovery" ? pageUrl("./reset-password.html?type=recovery") : pageUrl("./member-dashboard.html"));
    }, 1200);
  });
}
