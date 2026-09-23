import { supabase, authErrorMessage } from "./supabase-client.js";

const EVENT_IMAGE_BUCKET = "event-images";
const IMAGE_LIMIT = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const form = document.getElementById("eventForm");
const formTitle = document.getElementById("eventFormTitle");
const formStatus = document.getElementById("eventFormStatus");
const listStatus = document.getElementById("eventListStatus");
const list = document.getElementById("eventList");
const imageInput = document.getElementById("eventImage");
const imageMeta = document.getElementById("selectedEventImage");
const saveButton = document.getElementById("saveEventButton");
const draftButton = document.getElementById("saveEventDraft");
const cancelButton = document.getElementById("cancelEventEdit");

let events = [];
let initialized = false;

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `admin-status${type ? ` ${type}` : ""}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(fileName) {
  const dot = fileName.lastIndexOf(".");
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  const base = (dot >= 0 ? fileName.slice(0, dot) : fileName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "event";
  return `${base}${extension}`;
}

function validateImage(file) {
  if (!file) return "";
  if (!IMAGE_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP image.";
  if (file.size > IMAGE_LIMIT) return "The event image must be smaller than 5 MB.";
  return "";
}

function formatEventDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat("en-AU", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-AU", { month: "short" }).format(date).toUpperCase()
  };
}

function resetForm() {
  form.reset();
  document.getElementById("eventId").value = "";
  document.getElementById("currentEventImage").value = "";
  document.getElementById("eventPublished").checked = true;
  formTitle.textContent = "Create a new event";
  saveButton.textContent = "Publish event";
  draftButton.textContent = "Save draft";
  cancelButton.hidden = true;
  imageMeta.textContent = "Choose a JPG, PNG or WebP image, maximum 5 MB.";
}

function renderEvents() {
  if (!events.length) {
    list.innerHTML = '<p class="admin-help">No events have been created yet.</p>';
    return;
  }

  list.innerHTML = events.map((event) => {
    const date = formatEventDate(event.event_date);
    const toggleLabel = event.status === "published" ? "Hide" : "Publish";
    return `<article class="admin-event-item" data-event-id="${escapeHtml(event.id)}">
      <div class="admin-event-date"><strong>${date.day}</strong><span>${date.month}</span></div>
      <div class="admin-event-details">
        <h4>${escapeHtml(event.title)}</h4>
        <p>${escapeHtml(event.short_description)}</p>
        <p>${event.start_time ? `Starts ${escapeHtml(event.start_time.slice(0, 5))}` : "Time not specified"}</p>
        <span class="admin-event-status ${escapeHtml(event.status)}">${escapeHtml(event.status)}</span>
      </div>
      <div class="admin-event-controls">
        <button type="button" data-event-action="edit">Edit</button>
        <button type="button" data-event-action="toggle">${toggleLabel}</button>
        <button class="danger" type="button" data-event-action="delete">Delete</button>
      </div>
    </article>`;
  }).join("");
}

export async function loadEvents() {
  showStatus(listStatus, "Loading events…");
  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, start_time, short_description, registration_url, image_path, status, display_order, created_at")
    .order("event_date", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    showStatus(listStatus, authErrorMessage(error, "Unable to load events."), "error");
    return;
  }

  events = data || [];
  showStatus(listStatus, "");
  renderEvents();
}

function editEvent(event) {
  document.getElementById("eventId").value = event.id;
  document.getElementById("currentEventImage").value = event.image_path || "";
  document.getElementById("eventTitle").value = event.title;
  document.getElementById("eventDate").value = event.event_date;
  document.getElementById("eventTime").value = event.start_time?.slice(0, 5) || "";
  document.getElementById("eventDescription").value = event.short_description;
  document.getElementById("eventRegistrationUrl").value = event.registration_url || "";
  document.getElementById("eventPublished").checked = event.status === "published";
  formTitle.textContent = `Edit ${event.title}`;
  saveButton.textContent = "Save event";
  draftButton.textContent = "Save as draft";
  cancelButton.hidden = false;
  imageMeta.textContent = event.image_path
    ? `Current image: ${event.image_path}. Choose a file only to replace it.`
    : "No current image. Choose a JPG, PNG or WebP image, maximum 5 MB.";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function uploadImage(file, eventId) {
  const path = `${eventId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(EVENT_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  return path;
}

async function saveEvent(statusOverride = null) {
  if (!form.reportValidity()) return;

  const registrationValue = document.getElementById("eventRegistrationUrl").value.trim();
  if (registrationValue) {
    try {
      const url = new URL(registrationValue);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Unsupported URL protocol");
    } catch {
      showStatus(formStatus, "Enter a complete registration link beginning with http:// or https://.", "error");
      return;
    }
  }

  const file = imageInput.files[0];
  const imageError = validateImage(file);
  if (imageError) {
    showStatus(formStatus, imageError, "error");
    return;
  }

  const existingId = document.getElementById("eventId").value;
  const eventId = existingId || crypto.randomUUID();
  const oldImagePath = document.getElementById("currentEventImage").value;
  let newImagePath = "";
  const status = statusOverride || (document.getElementById("eventPublished").checked ? "published" : "draft");

  saveButton.disabled = true;
  draftButton.disabled = true;
  showStatus(formStatus, file ? "Uploading event image…" : "Saving event…");

  try {
    if (file) newImagePath = await uploadImage(file, eventId);
    const payload = {
      title: document.getElementById("eventTitle").value.trim(),
      event_date: document.getElementById("eventDate").value,
      start_time: document.getElementById("eventTime").value || null,
      short_description: document.getElementById("eventDescription").value.trim(),
      registration_url: registrationValue || null,
      image_path: newImagePath || oldImagePath || null,
      status
    };

    const result = existingId
      ? await supabase.from("events").update(payload).eq("id", eventId)
      : await supabase.from("events").insert({ id: eventId, ...payload });
    if (result.error) throw result.error;

    if (newImagePath && oldImagePath && oldImagePath !== newImagePath) {
      const { error } = await supabase.storage.from(EVENT_IMAGE_BUCKET).remove([oldImagePath]);
      if (error) console.warn("The previous event image could not be removed.", error);
    }

    resetForm();
    showStatus(formStatus, status === "published" ? "Event published successfully." : "Event saved as a draft.", "success");
    await loadEvents();
  } catch (error) {
    if (newImagePath) await supabase.storage.from(EVENT_IMAGE_BUCKET).remove([newImagePath]);
    showStatus(formStatus, authErrorMessage(error, "Unable to save the event."), "error");
  } finally {
    saveButton.disabled = false;
    draftButton.disabled = false;
  }
}

export function initEventsAdmin() {
  if (initialized) return;
  initialized = true;

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    imageMeta.textContent = file
      ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
      : "Choose a JPG, PNG or WebP image, maximum 5 MB.";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEvent();
  });
  draftButton.addEventListener("click", () => saveEvent("draft"));
  cancelButton.addEventListener("click", () => {
    resetForm();
    showStatus(formStatus, "");
  });
  document.getElementById("refreshEvents").addEventListener("click", loadEvents);

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-event-action]");
    if (!button) return;
    const item = button.closest("[data-event-id]");
    const selectedEvent = events.find((candidate) => candidate.id === item.dataset.eventId);
    if (!selectedEvent) return;

    const action = button.dataset.eventAction;
    if (action === "edit") {
      editEvent(selectedEvent);
      return;
    }

    button.disabled = true;
    if (action === "toggle") {
      const status = selectedEvent.status === "published" ? "hidden" : "published";
      const { error } = await supabase.from("events").update({ status }).eq("id", selectedEvent.id);
      if (error) showStatus(listStatus, authErrorMessage(error, "Unable to update this event."), "error");
      else await loadEvents();
      button.disabled = false;
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(`Delete ${selectedEvent.title}? This cannot be undone.`);
      if (!confirmed) {
        button.disabled = false;
        return;
      }
      const { error } = await supabase.from("events").delete().eq("id", selectedEvent.id);
      if (error) {
        showStatus(listStatus, authErrorMessage(error, "Unable to delete this event."), "error");
        button.disabled = false;
        return;
      }
      if (selectedEvent.image_path) {
        const { error: imageError } = await supabase.storage.from(EVENT_IMAGE_BUCKET).remove([selectedEvent.image_path]);
        if (imageError) console.warn("The event was deleted, but its image could not be removed.", imageError);
      }
      if (document.getElementById("eventId").value === selectedEvent.id) resetForm();
      await loadEvents();
    }
  });

  loadEvents();
}
