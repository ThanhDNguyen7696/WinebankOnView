import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH
} from "./supabase-config.js";
import {
  getSupabaseClient,
  getVerifiedUser,
  checkAdminAccess,
  withTimeout,
  friendlySupabaseError
} from "./supabase-client.js";

const gate = document.getElementById("adminGate");
const gateMessage = document.getElementById("adminGateMessage");
const gateDetail = document.getElementById("adminGateDetail");
const gateRetry = document.getElementById("adminGateRetry");
const app = document.getElementById("adminApp");
const uploadForm = document.getElementById("menuUploadForm");
const uploadStatus = document.getElementById("menuUploadStatus");
const currentMenuLink = document.getElementById("currentMenuLink");
const currentMenuName = document.getElementById("currentMenuName");
const currentMenuUpdated = document.getElementById("currentMenuUpdated");
const currentMenuSize = document.getElementById("currentMenuSize");
const selectedFile = document.getElementById("selectedFile");
const logoutButton = document.getElementById("adminLogout");
const refreshButton = document.getElementById("refreshMenuStatus");
const menuFileInput = document.getElementById("menuFile");
const replaceConfirm = document.getElementById("replaceConfirm");
const systemConnection = document.getElementById("systemConnection");
const systemAuth = document.getElementById("systemAuth");
const systemRole = document.getElementById("systemRole");
const systemStorage = document.getElementById("systemStorage");

let supabase;
let currentUser;

function setGate(message, detail = "", retry = false) {
  gateMessage.textContent = message;
  gateDetail.textContent = detail;
  gateRetry.hidden = !retry;
}

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `admin-status${type ? ` ${type}` : ""}`;
}

function setSystemStatus(element, value, state = "ok") {
  element.textContent = value;
  element.dataset.state = state;
}

function publicMenuUrl(cacheBust = true) {
  const base = `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${MENU_PATH}`;
  return cacheBust ? `${base}?v=${Date.now()}` : base;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function redirectToLogin(reason = "") {
  if (reason) sessionStorage.setItem("winebankAuthNotice", reason);
  window.location.replace("./login.html");
}

function redirectToMemberDashboard() {
  window.location.replace("./member-dashboard.html");
}

async function listCurrentMenu() {
  const slash = MENU_PATH.lastIndexOf("/");
  const folder = slash === -1 ? "" : MENU_PATH.slice(0, slash);
  const filename = slash === -1 ? MENU_PATH : MENU_PATH.slice(slash + 1);

  const { data, error } = await withTimeout(
    supabase.storage.from(MENU_BUCKET).list(folder, {
      search: filename,
      limit: 20,
      sortBy: { column: "updated_at", order: "desc" }
    }),
    12000,
    "Menu Storage check"
  );

  if (error) throw error;
  return data?.find((item) => item.name === filename) || null;
}

async function loadCurrentMenuInfo() {
  currentMenuName.textContent = MENU_PATH.split("/").pop() || MENU_PATH;
  currentMenuLink.href = publicMenuUrl();

  try {
    const file = await listCurrentMenu();
    setSystemStatus(systemStorage, "Storage ready", "ok");

    if (!file) {
      currentMenuUpdated.textContent = "No live PDF yet";
      currentMenuSize.textContent = "—";
      currentMenuLink.setAttribute("aria-disabled", "true");
      currentMenuLink.classList.add("is-disabled");
      currentMenuLink.removeAttribute("target");
      return null;
    }

    currentMenuLink.classList.remove("is-disabled");
    currentMenuLink.removeAttribute("aria-disabled");
    currentMenuLink.target = "_blank";
    const timestamp = file.updated_at || file.created_at;
    currentMenuUpdated.textContent = timestamp
      ? new Date(timestamp).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        })
      : "Available";
    currentMenuSize.textContent = formatBytes(file.metadata?.size);
    return file;
  } catch (error) {
    setSystemStatus(systemStorage, "Storage check failed", "error");
    currentMenuUpdated.textContent = "Unavailable";
    currentMenuSize.textContent = "—";
    throw error;
  }
}

async function verifyStillAdmin() {
  const user = await getVerifiedUser(supabase);
  if (!user) return false;
  const { isAdmin } = await checkAdminAccess(supabase, user.id);
  return isAdmin;
}

async function publishMenu(file) {
  const { error } = await withTimeout(
    supabase.storage.from(MENU_BUCKET).upload(MENU_PATH, file, {
      contentType: "application/pdf",
      cacheControl: "60",
      upsert: true
    }),
    30000,
    "PDF upload"
  );

  if (error) throw error;

  // Verify the object is actually visible in Storage after the upload returns.
  const uploaded = await listCurrentMenu();
  if (!uploaded) {
    throw new Error("The upload completed but the live PDF could not be verified in Storage.");
  }
  return uploaded;
}

async function initialise() {
  setGate("Connecting to WineBank administration…", "Checking Supabase, login session and administrator access.");

  try {
    supabase = getSupabaseClient();
    setSystemStatus(systemConnection, "Connected", "ok");

    currentUser = await getVerifiedUser(supabase);
    if (!currentUser) {
      setGate("Sign-in required", "Redirecting to the member login page…");
      window.setTimeout(() => redirectToLogin("Please sign in to continue."), 500);
      return;
    }
    setSystemStatus(systemAuth, "Authenticated", "ok");

    const { isAdmin } = await checkAdminAccess(supabase, currentUser.id);
    if (!isAdmin) {
      setSystemStatus(systemRole, "Not authorised", "error");
      setGate("Administrator access only", "This account is not authorised to manage the WineBank menu.");
      window.setTimeout(redirectToMemberDashboard, 1200);
      return;
    }
    setSystemStatus(systemRole, "Administrator", "ok");

    document.getElementById("adminIdentity").textContent = currentUser.email || "Authorised administrator";

    try {
      await loadCurrentMenuInfo();
    } catch (error) {
      showStatus(
        uploadStatus,
        `Signed in successfully, but the menu Storage check failed: ${friendlySupabaseError(error)}`,
        "error"
      );
    }

    gate.hidden = true;
    app.hidden = false;
    document.body.classList.remove("admin-locked");
  } catch (error) {
    console.error("WineBank admin initialisation failed:", error);
    setSystemStatus(systemConnection, "Connection failed", "error");
    setGate(
      "Administration could not start",
      friendlySupabaseError(error, "The WineBank administration service could not be reached."),
      true
    );
  }
}

menuFileInput?.addEventListener("change", (event) => {
  const file = event.target.files[0];
  selectedFile.textContent = file
    ? `${file.name} · ${formatBytes(file.size)}`
    : "No file selected";
  showStatus(uploadStatus, "");
});

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = menuFileInput.files[0];
  const submitButton = uploadForm.querySelector('button[type="submit"]');

  if (!file) {
    showStatus(uploadStatus, "Choose a PDF before publishing.", "error");
    return;
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showStatus(uploadStatus, "Only PDF menu files are accepted.", "error");
    return;
  }
  if (file.size <= 0) {
    showStatus(uploadStatus, "The selected PDF is empty.", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showStatus(uploadStatus, "The PDF must be smaller than 10 MB.", "error");
    return;
  }
  if (!replaceConfirm.checked) {
    showStatus(uploadStatus, "Confirm that you want to replace the live menu.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Checking access…";
  showStatus(uploadStatus, "Re-checking administrator access…");

  try {
    if (!(await verifyStillAdmin())) {
      throw new Error("Your administrator access is no longer valid.");
    }

    submitButton.textContent = "Publishing…";
    showStatus(uploadStatus, "Uploading and verifying the new menu…");
    await publishMenu(file);

    uploadForm.reset();
    selectedFile.textContent = "No file selected";
    currentMenuLink.href = publicMenuUrl();
    await loadCurrentMenuInfo();
    showStatus(uploadStatus, "Published successfully. The new dining menu is now live.", "success");
  } catch (error) {
    console.error("WineBank menu upload failed:", error);
    showStatus(uploadStatus, friendlySupabaseError(error, "The new menu could not be published."), "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Publish new menu";
  }
});

refreshButton?.addEventListener("click", async () => {
  refreshButton.disabled = true;
  showStatus(uploadStatus, "Refreshing live menu status…");
  try {
    await loadCurrentMenuInfo();
    showStatus(uploadStatus, "Live menu status refreshed.", "success");
  } catch (error) {
    showStatus(uploadStatus, friendlySupabaseError(error), "error");
  } finally {
    refreshButton.disabled = false;
  }
});

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await withTimeout(supabase.auth.signOut(), 10000, "Sign out");
  } catch (error) {
    console.warn("Sign out warning:", error);
  }
  redirectToLogin("You have been signed out.");
});

gateRetry?.addEventListener("click", () => window.location.reload());

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled WineBank admin error:", event.reason);
});

initialise();
