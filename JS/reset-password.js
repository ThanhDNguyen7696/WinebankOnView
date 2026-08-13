import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { setError, setStatus, setupPasswordToggles } from "./common.js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

setupPasswordToggles();

const form = document.getElementById("resetPasswordForm");
const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
  setStatus("resetPasswordStatus", "Password reset is being configured.", "error");
  form.querySelector('button[type="submit"]').disabled = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.getElementById("newPassword").value;
  const confirmation = document.getElementById("confirmNewPassword").value;
  const passwordError = !password
    ? "Password is required."
    : password.length < 8
      ? "Use at least 8 characters."
      : !/[A-Z]/.test(password) || !/[0-9]/.test(password)
        ? "Include at least one capital letter and one number."
        : "";
  const confirmationError = !confirmation
    ? "Please confirm your password."
    : confirmation !== password
      ? "Passwords do not match."
      : "";

  setError("newPassword", "newPasswordError", passwordError);
  setError("confirmNewPassword", "confirmNewPasswordError", confirmationError);
  if (passwordError || confirmationError || !supabase) return;

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Saving…";
  const { error } = await supabase.auth.updateUser({ password });
  button.disabled = false;
  button.textContent = "Save new password";

  if (error) {
    setStatus("resetPasswordStatus", error.message, "error");
    return;
  }

  setStatus("resetPasswordStatus", "Password updated. Redirecting to your dashboard…", "success");
  window.setTimeout(() => window.location.replace("./member-dashboard.html"), 1200);
});
