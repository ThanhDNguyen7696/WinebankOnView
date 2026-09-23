import {
  SUPABASE_URL,
  MENU_BUCKET,
  MENU_PATH,
  PIZZA_MENU_PATH
} from "./supabase-config.js";
import {
  supabase,
  isSupabaseConfigured,
  pageUrl,
  authErrorMessage,
  hasAdminAccess
} from "./supabase-client.js";
import { initMembershipAdmin } from "./memberships-admin.js";

const setupNotice = document.getElementById("setupNotice");
const adminOverview = document.getElementById("adminOverview");
const adminSession = document.getElementById("adminSession");
const menuPanel = document.getElementById("menuManagerPanel");
const membershipPanel = document.getElementById("membershipManagerPanel");
const cellarPanel = document.getElementById("cellarManagerPanel");
const uploadForm = document.getElementById("menuUploadForm");
const uploadStatus = document.getElementById("menuUploadStatus");
const currentMenuLink = document.getElementById("currentMenuLink");
const selectedFile = document.getElementById("selectedFile");
const pizzaUploadForm = document.getElementById("pizzaMenuUploadForm");
const pizzaUploadStatus = document.getElementById("pizzaMenuUploadStatus");
const currentPizzaMenuLink = document.getElementById("currentPizzaMenuLink");
const selectedPizzaMenuFile = document.getElementById("selectedPizzaMenuFile");
const logoutButton = document.getElementById("adminLogout");
const wineForm = document.getElementById("wineForm");
const wineFormStatus = document.getElementById("wineFormStatus");
const wineListStatus = document.getElementById("wineListStatus");
const wineList = document.getElementById("wineList");
const wineImageInput = document.getElementById("wineImage");
const selectedWineImage = document.getElementById("selectedWineImage");
const saveWineButton = document.getElementById("saveWineButton");
const cancelWineEdit = document.getElementById("cancelWineEdit");
const WINE_IMAGE_BUCKET = "wine-images";
const WINE_IMAGE_LIMIT = 5 * 1024 * 1024;
const WINE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  currentMenuLink.href = `${publicMenuUrl()}?v=${Date.now()}`;
  currentPizzaMenuLink.href = `${publicMenuUrl(PIZZA_MENU_PATH)}?v=${Date.now()}`;
}

function showOverview() {
  membershipPanel.hidden = true;
  cellarPanel.hidden = true;
  adminOverview.hidden = false;
  adminOverview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showWorkspace(panel) {
  adminOverview.hidden = true;
  membershipPanel.hidden = panel !== membershipPanel;
  cellarPanel.hidden = panel !== cellarPanel;
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
  form.reset();
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

function wineImageUrl(imagePath) {
  if (!imagePath) return "";
  return supabase.storage.from(WINE_IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

function safeFileName(fileName) {
  const dot = fileName.lastIndexOf(".");
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  const base = (dot >= 0 ? fileName.slice(0, dot) : fileName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "wine";
  return `${base}${extension}`;
}

function validateWineImage(file) {
  if (!file) return "";
  if (!WINE_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG or WebP image.";
  }
  if (file.size > WINE_IMAGE_LIMIT) {
    return "The wine image must be smaller than 5 MB.";
  }
  return "";
}

async function uploadWineImage(file, wineId) {
  const path = `${wineId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(WINE_IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;
  return path;
}

function resetWineForm() {
  wineForm.reset();
  document.getElementById("wineId").value = "";
  document.getElementById("currentWineImage").value = "";
  document.getElementById("wineVintage").value = "NV";
  document.getElementById("wineOrder").value = "0";
  document.getElementById("winePublished").checked = true;
  selectedWineImage.textContent = "Choose a JPG, PNG or WebP image, maximum 5 MB.";
  saveWineButton.textContent = "Add wine";
  cancelWineEdit.hidden = true;
}

function renderWines() {
  if (!wines.length) {
    wineList.innerHTML = '<p class="admin-help">No wines have been added yet.</p>';
    return;
  }

  wineList.innerHTML = wines.map((wine) => {
    const imageUrl = wineImageUrl(wine.image_path);
    const image = imageUrl
      ? `<img class="admin-wine-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(wine.name)}" loading="lazy" />`
      : '<div class="admin-wine-image admin-wine-image--empty">No image</div>';
    const publishedClass = wine.is_published ? "" : " hidden-wine";
    const publishedLabel = wine.is_published ? "Published" : "Hidden";
    const toggleLabel = wine.is_published ? "Hide" : "Publish";

    return `<article class="admin-wine-item" data-wine-id="${escapeHtml(wine.id)}">
      ${image}
      <div class="admin-wine-details">
        <h4>${escapeHtml(wine.name)}</h4>
        <p>${escapeHtml(wine.region)} · ${escapeHtml(wine.vintage)} · ${escapeHtml(wine.wine_type)}</p>
        <p><strong>$${Number(wine.price).toFixed(2)}</strong> · Display order ${Number(wine.display_order)}</p>
        <span class="admin-wine-badge${publishedClass}">${publishedLabel}</span>
      </div>
      <div class="admin-wine-controls">
        <button type="button" data-wine-action="edit">Edit</button>
        <button type="button" data-wine-action="toggle">${toggleLabel}</button>
        <button class="danger" type="button" data-wine-action="delete">Delete</button>
      </div>
    </article>`;
  }).join("");
}

async function loadWines() {
  showStatus(wineListStatus, "Loading wines…");
  const { data, error } = await supabase
    .from("wines")
    .select("id, name, region, vintage, price, wine_type, description, image_path, is_published, display_order, created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    showStatus(wineListStatus, authErrorMessage(error, "Unable to load wines."), "error");
    return;
  }

  wines = data || [];
  showStatus(wineListStatus, "");
  renderWines();
}

function editWine(wine) {
  document.getElementById("wineId").value = wine.id;
  document.getElementById("currentWineImage").value = wine.image_path || "";
  document.getElementById("wineName").value = wine.name;
  document.getElementById("wineRegion").value = wine.region;
  document.getElementById("wineVintage").value = wine.vintage;
  document.getElementById("winePrice").value = Number(wine.price).toFixed(2);
  document.getElementById("wineType").value = wine.wine_type;
  document.getElementById("wineOrder").value = wine.display_order;
  document.getElementById("wineDescription").value = wine.description || "";
  document.getElementById("winePublished").checked = wine.is_published;
  selectedWineImage.textContent = wine.image_path
    ? `Current image: ${wine.image_path}. Choose a file only to replace it.`
    : "No current image. Choose a JPG, PNG or WebP image, maximum 5 MB.";
  saveWineButton.textContent = "Save changes";
  cancelWineEdit.hidden = false;
  showStatus(wineFormStatus, `Editing ${wine.name}.`);
  wineForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
  });
  document.getElementById("backFromMemberships").addEventListener("click", showOverview);

  document.getElementById("openCellarManager").addEventListener("click", async () => {
    showWorkspace(cellarPanel);
    if (!winesLoaded) {
      winesLoaded = true;
      await loadWines();
    }
  });
  document.getElementById("backFromCellar").addEventListener("click", showOverview);

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const published = await publishMenu({
      form: uploadForm,
      fileInput: document.getElementById("menuFile"),
      status: uploadStatus,
      path: MENU_PATH,
      previewLink: currentMenuLink,
      label: "Dining menu"
    });
    if (published) selectedFile.textContent = "No file selected";
  });

  document.getElementById("pizzaMenuFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    selectedPizzaMenuFile.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "No file selected";
  });

  pizzaUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const published = await publishMenu({
      form: pizzaUploadForm,
      fileInput: document.getElementById("pizzaMenuFile"),
      status: pizzaUploadStatus,
      path: PIZZA_MENU_PATH,
      previewLink: currentPizzaMenuLink,
      label: "Pizza menu"
    });
    if (published) selectedPizzaMenuFile.textContent = "No file selected";
  });

  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.replace(pageUrl("./login.html"));
  });

  wineImageInput.addEventListener("change", () => {
    const file = wineImageInput.files[0];
    selectedWineImage.textContent = file
      ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
      : "Choose a JPG, PNG or WebP image, maximum 5 MB.";
  });

  cancelWineEdit.addEventListener("click", () => {
    resetWineForm();
    showStatus(wineFormStatus, "");
  });

  document.getElementById("refreshWines").addEventListener("click", loadWines);

  wineForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = wineImageInput.files[0];
    const imageError = validateWineImage(file);
    if (imageError) {
      showStatus(wineFormStatus, imageError, "error");
      return;
    }

    const existingId = document.getElementById("wineId").value;
    const wineId = existingId || crypto.randomUUID();
    const oldImagePath = document.getElementById("currentWineImage").value;
    let newImagePath = "";

    saveWineButton.disabled = true;
    saveWineButton.textContent = existingId ? "Saving…" : "Adding…";
    showStatus(wineFormStatus, file ? "Uploading image…" : "Saving wine…");

    try {
      if (file) newImagePath = await uploadWineImage(file, wineId);

      const payload = {
        name: document.getElementById("wineName").value.trim(),
        region: document.getElementById("wineRegion").value.trim(),
        vintage: document.getElementById("wineVintage").value.trim(),
        price: Number(document.getElementById("winePrice").value),
        wine_type: document.getElementById("wineType").value,
        description: document.getElementById("wineDescription").value.trim(),
        image_path: newImagePath || oldImagePath || null,
        is_published: document.getElementById("winePublished").checked,
        display_order: Number(document.getElementById("wineOrder").value)
      };

      const result = existingId
        ? await supabase.from("wines").update(payload).eq("id", wineId)
        : await supabase.from("wines").insert({ id: wineId, ...payload });

      if (result.error) throw result.error;

      if (newImagePath && oldImagePath && oldImagePath !== newImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from(WINE_IMAGE_BUCKET)
          .remove([oldImagePath]);
        if (cleanupError) console.warn("The previous wine image could not be removed.", cleanupError);
      }

      resetWineForm();
      showStatus(wineFormStatus, existingId ? "Wine updated successfully." : "Wine added successfully.", "success");
      await loadWines();
    } catch (error) {
      if (newImagePath) {
        await supabase.storage.from(WINE_IMAGE_BUCKET).remove([newImagePath]);
      }
      showStatus(wineFormStatus, authErrorMessage(error, "Unable to save the wine."), "error");
    } finally {
      saveWineButton.disabled = false;
      if (!document.getElementById("wineId").value) saveWineButton.textContent = "Add wine";
    }
  });

  wineList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-wine-action]");
    if (!button) return;
    const item = button.closest("[data-wine-id]");
    const wine = wines.find((candidate) => candidate.id === item.dataset.wineId);
    if (!wine) return;

    const action = button.dataset.wineAction;
    if (action === "edit") {
      editWine(wine);
      return;
    }

    button.disabled = true;
    if (action === "toggle") {
      const { error } = await supabase
        .from("wines")
        .update({ is_published: !wine.is_published })
        .eq("id", wine.id);
      if (error) {
        showStatus(wineListStatus, authErrorMessage(error, "Unable to update this wine."), "error");
        button.disabled = false;
        return;
      }
      await loadWines();
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(`Delete ${wine.name}? This cannot be undone.`);
      if (!confirmed) {
        button.disabled = false;
        return;
      }

      const { error } = await supabase.from("wines").delete().eq("id", wine.id);
      if (error) {
        showStatus(wineListStatus, authErrorMessage(error, "Unable to delete this wine."), "error");
        button.disabled = false;
        return;
      }

      if (wine.image_path) {
        const { error: imageError } = await supabase.storage
          .from(WINE_IMAGE_BUCKET)
          .remove([wine.image_path]);
        if (imageError) console.warn("The wine record was deleted, but its image could not be removed.", imageError);
      }

      if (document.getElementById("wineId").value === wine.id) resetWineForm();
      showStatus(wineListStatus, `${wine.name} was deleted.`, "success");
      await loadWines();
    }
  });
}
