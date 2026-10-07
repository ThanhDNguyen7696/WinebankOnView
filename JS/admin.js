import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH,
  PIZZA_MENU_PATH,
  SPECIAL_MENU_PATH,
  GLASS_MENU_PATH,
  BOTTLE_MENU_PATH,
  FUNCTION_BROCHURE_PATH
} from "./supabase-config.js";
import {
  supabase,
  isSupabaseConfigured,
  pageUrl,
  authErrorMessage,
  hasAdminAccess
} from "./supabase-client.js";
import { initMembershipAdmin } from "./memberships-admin.js";
import { initEventsAdmin } from "./events-admin.js";
import { loadSquareCellar } from "./square-catalog.js";

const setupNotice = document.getElementById("setupNotice");
const adminOverview = document.getElementById("adminOverview");
const adminSession = document.getElementById("adminSession");
const menuPanel = document.getElementById("menuManagerPanel");
const membershipPanel = document.getElementById("membershipManagerPanel");
const cellarPanel = document.getElementById("cellarManagerPanel");
const eventsPanel = document.getElementById("eventsManagerPanel");
const MENU_DEFINITIONS = [
  { key: "dining", label: "Dining menu", path: MENU_PATH, formId: "menuUploadForm", fileId: "menuFile", selectedId: "selectedFile", statusId: "menuUploadStatus", previewId: "currentMenuLink" },
  { key: "pizza", label: "Pizza menu", path: PIZZA_MENU_PATH, formId: "pizzaMenuUploadForm", fileId: "pizzaMenuFile", selectedId: "selectedPizzaMenuFile", statusId: "pizzaMenuUploadStatus", previewId: "currentPizzaMenuLink" },
  { key: "special", label: "Special menu", path: SPECIAL_MENU_PATH, formId: "specialMenuUploadForm", fileId: "specialMenuFile", selectedId: "selectedSpecialMenuFile", statusId: "specialMenuUploadStatus", previewId: "currentSpecialMenuLink" },
  { key: "glass", label: "Drinks by the Glass", path: GLASS_MENU_PATH, formId: "glassMenuUploadForm", fileId: "glassMenuFile", selectedId: "selectedGlassMenuFile", statusId: "glassMenuUploadStatus", previewId: "currentGlassMenuLink" },
  { key: "bottle", label: "Drinks by the Bottle", path: BOTTLE_MENU_PATH, formId: "bottleMenuUploadForm", fileId: "bottleMenuFile", selectedId: "selectedBottleMenuFile", statusId: "bottleMenuUploadStatus", previewId: "currentBottleMenuLink" },
  { key: "functions", label: "Function brochure", path: FUNCTION_BROCHURE_PATH, formId: "functionBrochureUploadForm", fileId: "functionBrochureFile", selectedId: "selectedFunctionBrochureFile", statusId: "functionBrochureUploadStatus", previewId: "currentFunctionBrochureLink" }
];
const logoutButton = document.getElementById("adminLogout");
const wineListStatus = document.getElementById("wineListStatus");
const wineList = document.getElementById("wineList");

let wines = [];
let winesLoaded = false;
let lastModalTrigger = null;

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `admin-status${type ? ` ${type}` : ""}`;
}

function publicMenuUrl(path = MENU_PATH) {
  return `${SUPABASE_URL}/storage/v1/object/public/${MENU_BUCKET}/${path}`;
}

function showLoggedIn(email) {
  adminOverview.hidden = false;
  adminSession.hidden = false;
  document.getElementById("adminIdentity").textContent = email;
  MENU_DEFINITIONS.forEach((menu) => {
    document.getElementById(menu.previewId).href = `${publicMenuUrl(menu.path)}?v=${Date.now()}`;
  });
  loadMenuVisibility();
}

async function loadMenuVisibility() {
  const { data, error } = await supabase
    .from("menu_settings")
    .select("menu_key, is_visible");

  if (error) {
    MENU_DEFINITIONS.forEach((menu) => {
      showStatus(document.getElementById(menu.statusId), "Run the latest supabase/setup.sql to enable Show/Hide controls.", "error");
    });
    return;
  }

  const visibility = new Map((data || []).map((item) => [item.menu_key, item.is_visible]));
  MENU_DEFINITIONS.forEach((menu) => {
    const toggle = document.querySelector(`[data-menu-visibility="${menu.key}"]`);
    toggle.checked = visibility.get(menu.key) !== false;
  });
}

async function saveMenuVisibility(toggle) {
  const menu = MENU_DEFINITIONS.find((item) => item.key === toggle.dataset.menuVisibility);
  if (!menu) return;
  const status = document.getElementById(menu.statusId);
  toggle.disabled = true;
  showStatus(status, toggle.checked ? "Showing this menu…" : "Hiding this menu…");

  const { error } = await supabase
    .from("menu_settings")
    .upsert({ menu_key: menu.key, is_visible: toggle.checked }, { onConflict: "menu_key" });

  toggle.disabled = false;
  if (error) {
    toggle.checked = !toggle.checked;
    showStatus(status, authErrorMessage(error, "Unable to update menu visibility."), "error");
    return;
  }
  showStatus(status, toggle.checked ? "Menu button is now visible." : "Menu button is now hidden.", "success");
}

function showOverview() {
  membershipPanel.hidden = true;
  cellarPanel.hidden = true;
  eventsPanel.hidden = true;
  adminOverview.hidden = false;
  adminOverview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showWorkspace(panel) {
  adminOverview.hidden = true;
  membershipPanel.hidden = panel !== membershipPanel;
  cellarPanel.hidden = panel !== cellarPanel;
  eventsPanel.hidden = panel !== eventsPanel;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openMenuModal(trigger) {
  lastModalTrigger = trigger;
  menuPanel.hidden = false;
  document.body.classList.add("admin-modal-open");
  document.getElementById("closeMenuManager").focus();
}

function closeMenuModal() {
  menuPanel.hidden = true;
  document.body.classList.remove("admin-modal-open");
  lastModalTrigger?.focus();
}

function validatePdf(file) {
  if (!file) return "Choose a PDF before publishing.";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF menu files are accepted.";
  }
  if (file.size > 10 * 1024 * 1024) return "The PDF must be smaller than 10 MB.";
  return "";
}

async function publishMenu({ form, fileInput, status, path, previewLink, label }) {
  const file = fileInput.files[0];
  const validationError = validatePdf(file);
  const submitButton = form.querySelector('button[type="submit"]');

  if (validationError) {
    showStatus(status, validationError, "error");
    return false;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Publishing…";
  showStatus(status, `Uploading the new ${label.toLowerCase()}…`);

  const { error } = await supabase.storage
    .from(MENU_BUCKET)
    .upload(path, file, {
      contentType: "application/pdf",
      cacheControl: "60",
      upsert: true
    });

  submitButton.disabled = false;
  submitButton.textContent = `Publish ${label.toLowerCase()}`;

  if (error) {
    showStatus(status, authErrorMessage(error, `Unable to upload the ${label.toLowerCase()}.`), "error");
    return false;
  }

  previewLink.href = `${publicMenuUrl(path)}?v=${Date.now()}`;
  fileInput.value = "";
  showStatus(status, `The new ${label.toLowerCase()} is now live.`, "success");
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const discountForm = document.getElementById("memberDiscountForm");
const discountInput = document.getElementById("memberDiscountPercent");
const discountStatus = document.getElementById("memberDiscountStatus");
const saveDiscountButton = document.getElementById("saveMemberDiscount");
let discountLoaded = false;

async function loadMemberDiscount() {
  showStatus(discountStatus, "Loading discount…");
  const { data, error } = await supabase
    .from("shop_settings")
    .select("member_discount_percent, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error?.code === "PGRST205" || (!error && !data)) {
    showStatus(discountStatus, "Run the \"Online shop settings\" section of supabase/setup.sql in Supabase to enable this setting.", "error");
    return;
  }
  if (error) {
    showStatus(discountStatus, authErrorMessage(error, "Unable to load the discount."), "error");
    return;
  }

  discountInput.value = data.member_discount_percent;
  discountInput.disabled = false;
  saveDiscountButton.disabled = false;
  showStatus(discountStatus, `Last updated ${new Date(data.updated_at).toLocaleString("en-AU")}.`);
}

async function saveMemberDiscount(event) {
  event.preventDefault();
  const percent = Number(discountInput.value);
  if (discountInput.value.trim() === "" || !Number.isInteger(percent) || percent < 0 || percent > 100) {
    showStatus(discountStatus, "Enter a whole number from 0 to 100.", "error");
    discountInput.focus();
    return;
  }

  saveDiscountButton.disabled = true;
  showStatus(discountStatus, "Saving…");
  const { data, error } = await supabase
    .from("shop_settings")
    .update({ member_discount_percent: percent })
    .eq("id", 1)
    .select("member_discount_percent");
  saveDiscountButton.disabled = false;

  if (error || !data?.length) {
    showStatus(discountStatus, error ? authErrorMessage(error, "Unable to save the discount.") : "The discount was not saved. Check that your account is an admin.", "error");
    return;
  }
  showStatus(discountStatus, percent
    ? `Members now save ${percent}% at online checkout.`
    : "Online member discount is turned off.", "success");
}

function renderWines() {
  if (!wines.length) {
    wineList.innerHTML = '<p class="admin-help">No Square items were found in the cellar categories.</p>';
    return;
  }

  wineList.innerHTML = wines.map((wine) => {
    const image = wine.imageUrl
      ? `<img class="admin-wine-image" src="${escapeHtml(wine.imageUrl)}" alt="${escapeHtml(wine.name)}" loading="lazy" />`
      : '<div class="admin-wine-image admin-wine-image--empty">No image</div>';
    const price = wine.price === null
      ? "Variable price"
      : `${wine.priceFrom ? "From " : ""}$${wine.price.toFixed(2)}`;

    return `<article class="admin-wine-item">
      ${image}
      <div class="admin-wine-details">
        <h4>${escapeHtml(wine.name)}</h4>
        <p>${escapeHtml([wine.categoryLabel, wine.subcategory, wine.vintage].filter(Boolean).join(" · "))}</p>
        <p><strong>${price}</strong></p>
      </div>
    </article>`;
  }).join("");
}

async function loadWines() {
  showStatus(wineListStatus, "Loading wines from Square…");
  try {
    wines = await loadSquareCellar();
  } catch (error) {
    showStatus(wineListStatus, error.message || "Unable to load wines from Square.", "error");
    return;
  }

  showStatus(wineListStatus, `${wines.length} wine${wines.length === 1 ? "" : "s"} shown on the Cellar page.`);
  renderWines();
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

  MENU_DEFINITIONS.forEach((menu) => {
    const form = document.getElementById(menu.formId);
    const fileInput = document.getElementById(menu.fileId);
    const selected = document.getElementById(menu.selectedId);
    const status = document.getElementById(menu.statusId);
    const previewLink = document.getElementById(menu.previewId);
    const visibilityToggle = document.querySelector(`[data-menu-visibility="${menu.key}"]`);

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      selected.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "No file selected";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const published = await publishMenu({
        form,
        fileInput,
        status,
        path: menu.path,
        previewLink,
        label: menu.label
      });
      if (published) selected.textContent = "No file selected";
    });

    visibilityToggle.addEventListener("change", () => saveMenuVisibility(visibilityToggle));
  });

  document.getElementById("openMenuManager").addEventListener("click", (event) => {
    openMenuModal(event.currentTarget);
  });

  menuPanel.querySelectorAll("[data-close-menu-modal]").forEach((button) => {
    button.addEventListener("click", closeMenuModal);
  });
  document.getElementById("closeMenuManager").addEventListener("click", closeMenuModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menuPanel.hidden) closeMenuModal();
  });

  document.getElementById("openMembershipManager").addEventListener("click", () => {
    initMembershipAdmin();
    showWorkspace(membershipPanel);
    if (!discountLoaded) {
      discountLoaded = true;
      loadMemberDiscount();
    }
  });
  discountForm.addEventListener("submit", saveMemberDiscount);
  document.getElementById("backFromMemberships").addEventListener("click", showOverview);

  document.getElementById("openCellarManager").addEventListener("click", async () => {
    showWorkspace(cellarPanel);
    if (!winesLoaded) {
      winesLoaded = true;
      await loadWines();
    }
  });
  document.getElementById("backFromCellar").addEventListener("click", showOverview);

  document.getElementById("openEventsManager").addEventListener("click", () => {
    initEventsAdmin();
    showWorkspace(eventsPanel);
  });
  document.getElementById("backFromEvents").addEventListener("click", showOverview);

  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.replace(pageUrl("./login.html"));
  });

  document.getElementById("refreshWines").addEventListener("click", loadWines);
}
