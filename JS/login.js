import {
  validEmail,
  setError,
  setStatus,
  setupPasswordToggles
} from "./common.js";

setupPasswordToggles();

const form = document.getElementById("loginForm");
const forgotPassword = document.getElementById("forgotPassword");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("loginStatus", "", "");

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const rememberMe = document.getElementById("rememberMe").checked;

  const emailError = !email
    ? "Email is required."
    : !validEmail(email)
      ? "Please enter a valid email address."
      : "";

  const passwordError = !password ? "Password is required." : "";

  setError("loginEmail", "loginEmailError", emailError);
  setError("loginPassword", "loginPasswordError", passwordError);

  if (emailError || passwordError) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Logging in...";

  try {
    // Replace demo code with a real backend request later:
    //
    // const response = await fetch("/api/auth/login", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   credentials: "include",
    //   body: JSON.stringify({ email, password, rememberMe })
    // });
    //
    // if (!response.ok) {
    //   throw new Error("Incorrect email or password.");
    // }
    //
    // window.location.href = "./member-dashboard.html";

    localStorage.setItem("winebankDemoUser", JSON.stringify({
      firstName: "Jessica",
      email,
      membershipStatus: "Pending"
    }));

    window.location.href = "./member-dashboard.html";
  } catch (error) {
    setStatus(
      "loginStatus",
      error.message || "Unable to log in. Please try again.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Log in";
  }
});

forgotPassword.addEventListener("click", () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email || !validEmail(email)) {
    setStatus(
      "loginStatus",
      "Enter a valid email address first.",
      "error"
    );
    return;
  }

  setStatus(
    "loginStatus",
    `Demo: a password reset link would be sent to ${email}.`,
    "success"
  );
});
