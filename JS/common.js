export function $(selector) {
  return document.querySelector(selector);
}

export function $$(selector) {
  return document.querySelectorAll(selector);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validAustralianPhone(value) {
  const cleaned = value.replace(/[\s()-]/g, "");
  return /^(\+61|0)[2-478]\d{8}$/.test(cleaned);
}

export function setError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  if (input) {
    input.classList.toggle("invalid", Boolean(message));
  }

  if (error) {
    error.textContent = message;
  }
}

export function setStatus(id, message, type) {
  const box = document.getElementById(id);
  if (!box) return;

  box.className = "status";

  if (!message) {
    box.textContent = "";
    return;
  }

  box.textContent = message;
  box.classList.add(type === "success" ? "success-status" : "error-status");
}

export function setupPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;

      const isVisible = input.type === "text";
      input.type = isVisible ? "password" : "text";
      button.textContent = isVisible ? "Show" : "Hide";
    });
  });
}
