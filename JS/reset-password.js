import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validEmail, setError, setStatus, setupPasswordToggles } from "./common.js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

setupPasswordToggles();

const form = document.getElementById("resetPasswordForm");
const requestForm = document.getElementById("requestResetForm");
const requestPanel = document.getElementById("requestResetPanel");
const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
  setStatus("requestResetStatus", "Password reset is being configured.", "error");
  requestForm.querySelector('button[type="submit"]').disabled = true;
} else {
  document.getElementById("resetEmail").value =
    new URLSearchParams(window.location.search).get("email") || "";

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    requestPanel.hidden = true;
    form.hidden = false;
  }
}

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("resetEmail").value.trim();
  const emailError = !email
    ? "Email is required."
    : !validEmail(email)
      ? "Please enter a valid email address."
      : "";

  setError("resetEmail", "resetEmailError", emailError);
  if (emailError || !supabase) return;

  const button = requestForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Sending…";
  const redirectTo = new URL("./reset-password.html", window.location.href).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  button.disabled = false;
  button.textContent = "Send reset link";

  setStatus(
    "requestResetStatus",
    error ? error.message : `A password reset link has been sent to ${email}.`,
    error ? "error" : "success"
  );
});

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
