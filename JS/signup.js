import {
  validEmail,
  validAustralianPhone,
  setError,
  setStatus,
  setupPasswordToggles
} from "./common.js";
import { supabase, isSupabaseConfigured, pageUrl, authErrorMessage } from "./supabase-client.js";

setupPasswordToggles();

const form = document.getElementById("signupForm");
if (!isSupabaseConfigured) {
  setStatus("signupStatus", "Account registration is being configured. Please try again later.", "error");
  form.querySelector('button[type="submit"]').disabled = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("signupStatus", "", "");

  const data = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("signupEmail").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    password: document.getElementById("signupPassword").value,
    confirmPassword: document.getElementById("confirmPassword").value,
    ageConfirmed: document.getElementById("ageCheck").checked,
    termsAccepted: document.getElementById("termsCheck").checked,
    marketingConsent: document.getElementById("marketingCheck").checked
  };

  const errors = {
    firstName: !data.firstName ? "First name is required." : "",
    lastName: !data.lastName ? "Last name is required." : "",
    email: !data.email
      ? "Email is required."
      : !validEmail(data.email)
        ? "Please enter a valid email address."
        : "",
    phone: !data.phone
      ? "Phone number is required."
      : !validAustralianPhone(data.phone)
        ? "Please enter a valid Australian phone number."
        : "",
    password: !data.password
      ? "Password is required."
      : data.password.length < 8
        ? "Use at least 8 characters."
        : !/[A-Z]/.test(data.password) || !/[0-9]/.test(data.password)
          ? "Include at least one capital letter and one number."
          : "",
    confirmPassword: !data.confirmPassword
      ? "Please confirm your password."
      : data.confirmPassword !== data.password
        ? "Passwords do not match."
        : ""
  };

  setError("firstName", "firstNameError", errors.firstName);
  setError("lastName", "lastNameError", errors.lastName);
  setError("signupEmail", "signupEmailError", errors.email);
  setError("phone", "phoneError", errors.phone);
  setError("signupPassword", "signupPasswordError", errors.password);
  setError("confirmPassword", "confirmPasswordError", errors.confirmPassword);

  document.getElementById("ageCheckError").textContent =
    data.ageConfirmed ? "" : "You must confirm that you are 18 or older.";

  document.getElementById("termsCheckError").textContent =
    data.termsAccepted ? "" : "You must accept the terms to continue.";

  const hasErrors =
    Object.values(errors).some(Boolean) ||
    !data.ageConfirmed ||
    !data.termsAccepted;

  if (hasErrors || !supabase) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";

  try {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: pageUrl("./confirm-email.html"),
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          age_confirmed: data.ageConfirmed,
          terms_accepted: data.termsAccepted,
          marketing_consent: data.marketingConsent,
          marketing_consent_at: data.marketingConsent ? new Date().toISOString() : null
        }
      }
    });

    if (error) throw error;

    form.reset();
    if (result.session) {
      setStatus("signupStatus", "Account created. Redirecting to your dashboard…", "success");
      window.setTimeout(() => window.location.replace(pageUrl("./member-dashboard.html")), 1000);
      return;
    }

    setStatus("signupStatus", `We sent a confirmation link to ${data.email}. Confirm your email before signing in.`, "success");
  } catch (error) {
    setStatus("signupStatus", authErrorMessage(error, "Unable to create the account."), "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});
