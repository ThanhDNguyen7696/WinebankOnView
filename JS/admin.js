import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  MENU_BUCKET,
  MENU_PATH,
  hasSupabaseConfig
} from "./supabase-config.js";

const setupNotice = document.getElementById("setupNotice");
const loginPanel = document.getElementById("adminLoginPanel");
const menuPanel = document.getElementById("menuManagerPanel");
const loginForm = document.getElementById("adminLoginForm");
const uploadForm = document.getElementById("menuUploadForm");
const loginStatus = document.getElementById("adminLoginStatus");
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

function showLoggedOut() {
  loginPanel.hidden = false;
  menuPanel.hidden = true;
}

function showLoggedIn(email) {
  loginPanel.hidden = true;
  menuPanel.hidden = false;
  document.getElementById("adminIdentity").textContent = email;
  currentMenuLink.href = `${publicMenuUrl()}?v=${Date.now()}`;
}

async function confirmAdmin(supabase, user) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return !error && Boolean(data);
}

if (!hasSupabaseConfig()) {
  setupNotice.hidden = false;
  loginPanel.hidden = true;
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabase.auth.getSession();

  if (session && await confirmAdmin(supabase, session.user)) {
    showLoggedIn(session.user.email);
  } else {
    if (session) await supabase.auth.signOut();
    showLoggedOut();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showStatus(loginStatus, "Signing in…");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: document.getElementById("adminEmail").value.trim(),
      password: document.getElementById("adminPassword").value
    });

    submitButton.disabled = false;
    if (error) {
      showStatus(loginStatus, error.message, "error");
      return;
    }

    if (!await confirmAdmin(supabase, data.user)) {
      await supabase.auth.signOut();
      showStatus(loginStatus, "This account does not have menu administration access.", "error");
      return;
    }

    showStatus(loginStatus, "");
    showLoggedIn(data.user.email);
  });

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
      showStatus(uploadStatus, error.message, "error");
      return;
    }

    currentMenuLink.href = `${publicMenuUrl()}?v=${Date.now()}`;
    uploadForm.reset();
    selectedFile.textContent = "No file selected";
    showStatus(uploadStatus, "The new dining menu is now live.", "success");
  });

  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    showLoggedOut();
  });
}
