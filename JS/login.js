import {
  validEmail,
  setError,
  setStatus,
  setupPasswordToggles
} from "./common.js";
import {
  supabase,
  isSupabaseConfigured,
  pageUrl,
  authErrorMessage
} from "./supabase-client.js";

setupPasswordToggles();

const form = document.getElementById("loginForm");
const forgotPassword = document.getElementById("forgotPassword");
if (!isSupabaseConfigured) {
  setStatus("loginStatus", "Account login is being configured. Please try again later.", "error");
  form.querySelector('button[type="submit"]').disabled = true;
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
  submitButton.textContent = "Logging in...";

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.replace(pageUrl("./member-dashboard.html"));
  } catch (error) {
    setStatus("loginStatus", authErrorMessage(error, "Unable to log in."), "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Log in";
  }
});

forgotPassword.addEventListener("click", () => {
  const email = document.getElementById("loginEmail").value.trim();
  const resetUrl = new URL(pageUrl("./reset-password.html"));
  if (validEmail(email)) resetUrl.searchParams.set("email", email);
  window.location.href = resetUrl.href;
});
