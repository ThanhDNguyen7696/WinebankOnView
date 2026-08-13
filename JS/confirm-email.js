import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { setStatus } from "./common.js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

const button = document.getElementById("confirmButton");
const params = new URLSearchParams(window.location.search);
const tokenHash = params.get("token_hash");
const type = params.get("type") || "signup";

if (!hasSupabaseConfig()) {
  setStatus("confirmStatus", "Email confirmation is being configured. Please try again later.", "error");
  button.disabled = true;
} else if (!tokenHash) {
  setStatus("confirmStatus", "This confirmation link is missing required information. Request a new one and try again.", "error");
  button.disabled = true;
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Confirming…";

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      button.disabled = false;
      button.textContent = "Confirm my email";
      setStatus("confirmStatus", error.message, "error");
      return;
    }

    setStatus("confirmStatus", "Confirmed. Redirecting…", "success");
    window.setTimeout(() => {
      window.location.replace(type === "recovery" ? "./reset-password.html" : "./member-dashboard.html");
    }, 1200);
  });
}
