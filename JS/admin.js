import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH
} from "./supabase-config.js";
import {
  supabase,
  isSupabaseConfigured,
  pageUrl,
  authErrorMessage,
  hasAdminAccess
} from "./supabase-client.js";

const setupNotice = document.getElementById("setupNotice");
const menuPanel = document.getElementById("menuManagerPanel");
const uploadForm = document.getElementById("menuUploadForm");
const uploadStatus = document.getElementById("menuUploadStatus");
const currentMenuLink = document.getElementById("currentMenuLink");
const selectedFile = document.getElementById("selectedFile");
const logoutButton = document.getElementById("adminLogout");

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `admin-status${type ? ` ${type}` : ""}`;
}

function publicMenuUrl() {
  return `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${MENU_PATH}`;
}

function showLoggedIn(email) {
  menuPanel.hidden = false;
  document.getElementById("adminIdentity").textContent = email;
  currentMenuLink.href = `${publicMenuUrl()}?v=${Date.now()}`;
}

if (!isSupabaseConfigured) {
  setupNotice.hidden = false;
} else {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      window.location.replace(pageUrl("./login.html"));
    } else if (!await hasAdminAccess(user)) {
      window.location.replace(pageUrl("./member-dashboard.html"));
    } else {
      showLoggedIn(user.email);
    }
  } catch (error) {
    setupNotice.hidden = false;
    setupNotice.querySelector("h2").textContent = "Unable to verify admin access";
    setupNotice.querySelector("p").textContent = authErrorMessage(error, "Please try again later.");
  }

  document.getElementById("menuFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    selectedFile.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "No file selected";
  });

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = document.getElementById("menuFile").files[0];
    const submitButton = uploadForm.querySelector('button[type="submit"]');

    if (!file) {
      showStatus(uploadStatus, "Choose a PDF before publishing.", "error");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showStatus(uploadStatus, "Only PDF menu files are accepted.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showStatus(uploadStatus, "The PDF must be smaller than 10 MB.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Publishing…";
    showStatus(uploadStatus, "Uploading the new menu…");

    const { error } = await supabase.storage
      .from(MENU_BUCKET)
      .upload(MENU_PATH, file, {
        contentType: "application/pdf",
        cacheControl: "60",
        upsert: true
      });

    submitButton.disabled = false;
    submitButton.textContent = "Publish new menu";

    if (error) {
      showStatus(uploadStatus, authErrorMessage(error, "Unable to upload the menu."), "error");
      return;
    }

    currentMenuLink.href = `${publicMenuUrl()}?v=${Date.now()}`;
    uploadForm.reset();
    selectedFile.textContent = "No file selected";
    showStatus(uploadStatus, "The new dining menu is now live.", "success");
  });

  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.replace(pageUrl("./login.html"));
  });
}
