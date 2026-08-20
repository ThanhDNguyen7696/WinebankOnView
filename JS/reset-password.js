import { validEmail, setError, setStatus, setupPasswordToggles } from "./common.js";
import { supabase, isSupabaseConfigured, pageUrl, authErrorMessage } from "./supabase-client.js";

setupPasswordToggles();

const passwordForm = document.getElementById("resetPasswordForm");
const requestForm = document.getElementById("requestResetForm");
const requestPanel = document.getElementById("requestResetPanel");
const params = new URLSearchParams(window.location.search);
const recoveryLink = params.get("type") === "recovery" ||
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

function showPasswordForm() {
  requestPanel.hidden = true;
  passwordForm.hidden = false;
}

if (!isSupabaseConfigured) {
  setStatus("requestResetStatus", "Password reset is being configured.", "error");
  requestForm.querySelector('button[type="submit"]').disabled = true;
} else {
  document.getElementById("resetEmail").value = params.get("email") || "";

  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showPasswordForm();
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (recoveryLink && session) showPasswordForm();
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
  let error;
  try {
    ({ error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: pageUrl("./reset-password.html?type=recovery")
    }));
  } catch (requestError) {
    error = requestError;
  }
  button.disabled = false;
  button.textContent = "Send reset link";

  setStatus(
    "requestResetStatus",
    error ? authErrorMessage(error, "Unable to send the reset link.") : `If an account exists for ${email}, a reset link has been sent.`,
    error ? "error" : "success"
  );
});

passwordForm.addEventListener("submit", async (event) => {
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

  const button = passwordForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Saving…";
  let error;
  try {
    ({ error } = await supabase.auth.updateUser({ password }));
  } catch (requestError) {
    error = requestError;
  }
  button.disabled = false;
  button.textContent = "Save new password";

  if (error) {
    setStatus("resetPasswordStatus", authErrorMessage(error, "Unable to update the password."), "error");
    return;
  }

  await supabase.auth.signOut();
  setStatus("resetPasswordStatus", "Password updated. Redirecting to login…", "success");
  window.setTimeout(() => window.location.replace(pageUrl("./login.html")), 1000);
});
