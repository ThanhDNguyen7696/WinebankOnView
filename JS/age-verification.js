const storageKey = "winebankAgeVerified";

export function hasVerifiedAge() {
  return localStorage.getItem(storageKey) === "true";
}

export function verifyAge() {
  localStorage.setItem(storageKey, "true");
}

export function clearAgeVerification() {
  localStorage.removeItem(storageKey);
}

