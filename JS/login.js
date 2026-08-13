import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validEmail,
  setError,
  setStatus,
  setupPasswordToggles
} from "./common.js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

setupPasswordToggles();

const form = document.getElementById("loginForm");
const forgotPassword = document.getElementById("forgotPassword");
const supabase = hasSupabaseConfig()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  submitButton.disabled = false;
  submitButton.textContent = "Log in";

  if (error) {
    setStatus(
      "loginStatus",
      "Incorrect email or password, or the email has not been confirmed.",
      "error"
    );
    return;
  }

  window.location.href = "./member-dashboard.html";
});

forgotPassword.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email || !validEmail(email)) {
    setStatus(
      "loginStatus",
      "Enter a valid email address first.",
      "error"
    );
    return;
  }

  if (!supabase) return;

  const redirectTo = new URL("./reset-password.html", window.location.href).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  setStatus(
    "loginStatus",
    error ? error.message : `A password reset link has been sent to ${email}.`,
    error ? "error" : "success"
  );
});
