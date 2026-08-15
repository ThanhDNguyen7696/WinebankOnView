import {
  validEmail,
  setError,
  setStatus,
  setupPasswordToggles
} from "./common.js";
import {
  getSupabaseClient,
  checkAdminAccess,
  withTimeout,
  friendlySupabaseError
} from "./supabase-client.js";

setupPasswordToggles();

const form = document.getElementById("loginForm");
const forgotPassword = document.getElementById("forgotPassword");
let supabase = null;

try {
  supabase = getSupabaseClient();
} catch (error) {
  setStatus("loginStatus", friendlySupabaseError(error, "Account login is unavailable."), "error");
  form.querySelector('button[type="submit"]').disabled = true;
}

const authNotice = sessionStorage.getItem("winebankAuthNotice");
if (authNotice) {
  sessionStorage.removeItem("winebankAuthNotice");
  setStatus("loginStatus", authNotice, "success");
} else if (sessionStorage.getItem("winebankSignupSuccess")) {
  sessionStorage.removeItem("winebankSignupSuccess");
  setStatus("loginStatus", "Account created successfully. Please log in.", "success");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("loginStatus", "", "");

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const emailError = !email
    ? "Email is required."
    : !validEmail(email)
      ? "Please enter a valid email address."
      : "";
  const passwordError = !password ? "Password is required." : "";

  setError("loginEmail", "loginEmailError", emailError);
  setError("loginPassword", "loginPasswordError", passwordError);
  if (emailError || passwordError || !supabase) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Logging in…";

  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      15000,
      "Sign in"
    );

    if (error) throw error;
    if (!data?.user) throw new Error("Login completed without a user session.");

    setStatus("loginStatus", "Login successful. Checking account access…", "");
    submitButton.textContent = "Checking access…";

    const { isAdmin } = await checkAdminAccess(supabase, data.user.id);
    window.location.replace(isAdmin ? "./admin.html" : "./member-dashboard.html");
  } catch (error) {
    console.error("WineBank login failed:", error);
    submitButton.disabled = false;
    submitButton.textContent = "Log in";

    const message = /invalid login credentials|email not confirmed/i.test(String(error?.message || ""))
      ? "Incorrect email or password, or the email has not been confirmed."
      : friendlySupabaseError(error, "Login failed. Please try again.");
    setStatus("loginStatus", message, "error");
  }
});

forgotPassword.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email || !validEmail(email)) {
    setStatus("loginStatus", "Enter a valid email address first.", "error");
    return;
  }
  if (!supabase) return;

  try {
    const redirectTo = new URL("./reset-password.html", window.location.href).href;
    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, { redirectTo }),
      15000,
      "Password reset request"
    );
    if (error) throw error;
    setStatus("loginStatus", `A password reset link has been sent to ${email}.`, "success");
  } catch (error) {
    setStatus("loginStatus", friendlySupabaseError(error, "Password reset failed."), "error");
  }
});
