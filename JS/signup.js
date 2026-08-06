import {
  validEmail,
  validAustralianPhone,
  setError,
  setStatus,
  setupPasswordToggles
} from "./common.js";

setupPasswordToggles();

const form = document.getElementById("signupForm");

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

  if (hasErrors) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";

  try {
    // Replace demo code with a real backend request later:
    //
    // const response = await fetch("/api/auth/signup", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   credentials: "include",
    //   body: JSON.stringify({
    //     firstName: data.firstName,
    //     lastName: data.lastName,
    //     email: data.email,
    //     phone: data.phone,
    //     password: data.password,
    //     ageConfirmed: data.ageConfirmed,
    //     termsAccepted: data.termsAccepted,
    //     marketingConsent: data.marketingConsent
    //   })
    // });
    //
    // if (!response.ok) {
    //   throw new Error("Unable to create account.");
    // }

    localStorage.setItem("winebankDemoUser", JSON.stringify({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      membershipStatus: "Pending"
    }));

    window.location.href = "./member-dashboard.html";
  } catch (error) {
    setStatus(
      "signupStatus",
      error.message || "Unable to create your account. Please try again.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});
