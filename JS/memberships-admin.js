import { supabase, authErrorMessage } from "./supabase-client.js";

const panel = document.getElementById("membershipManagerPanel");
const list = document.getElementById("membershipList");
const listStatus = document.getElementById("membershipListStatus");
const summary = document.getElementById("membershipSummary");
const searchInput = document.getElementById("membershipSearch");
const csvInput = document.getElementById("membershipCsv");
const csvMeta = document.getElementById("membershipCsvMeta");
const importButton = document.getElementById("importMemberships");
const importStatus = document.getElementById("membershipImportStatus");
const exportButton = document.getElementById("exportMemberships");

let memberships = [];
let preparedImports = [];
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addOneYear(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function effectiveStatus(membership) {
  if (membership.status === "active" && membership.expiry_date && membership.expiry_date < todayIso()) {
    return "expired";
  }
  return membership.status;
}

function memberName(membership) {
  const name = `${membership.first_name || ""} ${membership.last_name || ""}`.trim();
  return name || membership.email || "Unnamed member";
}

function csvCell(value) {
  let safeValue = String(value ?? "");
  if (/^[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function exportMembershipsCsv() {
  const columns = [
    ["First Name", "first_name"],
    ["Last Name", "last_name"],
    ["Email", "email"],
    ["Phone", "phone"],
    ["Customer Category", "customer_category"],
    ["Status", "status"],
    ["Start Date", "start_date"],
    ["Expiry Date", "expiry_date"],
    ["Website Account Linked", "account_linked"],
    ["Source", "source"],
    ["Record Created", "created_at"]
  ];

  const rows = memberships.map((membership) => ({
    ...membership,
    status: effectiveStatus(membership),
    account_linked: membership.user_id ? "Yes" : "No"
  }));
  const csv = [
    columns.map(([heading]) => csvCell(heading)).join(","),
    ...rows.map((membership) => columns
      .map(([, key]) => csvCell(membership[key]))
      .join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `winebank-members-${todayIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus(listStatus, `${memberships.length} membership records exported.`, "success");
}

function renderMemberships() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = query
    ? memberships.filter((membership) => {
      const haystack = `${memberName(membership)} ${membership.email || ""} ${membership.phone || ""}`.toLowerCase();
      return haystack.includes(query);
    })
    : memberships
      .filter((membership) => effectiveStatus(membership) === "active")
      .slice(0, 10);

  const statusCounts = memberships.reduce((counts, membership) => {
    const status = effectiveStatus(membership);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  summary.textContent = query
    ? `${visible.length} search results · ${memberships.length} total records`
    : `Showing ${visible.length} of ${statusCounts.active || 0} active members · ${memberships.length} total records`;

  if (!visible.length) {
    list.innerHTML = query
      ? '<p class="admin-help">No membership records match this search.</p>'
      : '<p class="admin-help">No active memberships are available. Use search to find pending or inactive records.</p>';
    return;
  }

  list.innerHTML = visible.map((membership) => {
    const status = effectiveStatus(membership);
    const linked = membership.user_id ? "Website account linked" : "Legacy member — no website account";
    const primaryAction = status === "pending" ? '<button class="primary-action" data-membership-action="activate">Activate</button>' : '<button class="primary-action" data-membership-action="renew">Renew 1 year</button>';

    return `<article class="admin-membership-item" data-membership-id="${escapeHtml(membership.id)}">
      <div class="admin-membership-identity">
        <h3>${escapeHtml(memberName(membership))}</h3>
        <p>${escapeHtml(membership.email || "No email")}</p>
        <p>${escapeHtml(membership.phone || "No phone")}</p>
        <p>${escapeHtml(membership.customer_category || "Member")} · ${escapeHtml(linked)}</p>
        <span class="admin-membership-badge ${escapeHtml(status)}">${escapeHtml(status)}</span>
      </div>
      <div class="admin-membership-dates">
        <label>Start date
          <input type="date" data-membership-field="start_date" value="${escapeHtml(membership.start_date || "")}" />
        </label>
        <label>Expiry date
          <input type="date" data-membership-field="expiry_date" value="${escapeHtml(membership.expiry_date || "")}" />
        </label>
        <p>${membership.source === "legacy_csv" ? "Imported from customer list" : "Created from website signup"}</p>
      </div>
      <div class="admin-membership-controls">
        ${primaryAction}
        <button data-membership-action="save-dates">Save dates</button>
        <button data-membership-action="suspend">Suspend</button>
        <button data-membership-action="cancel">Cancel</button>
      </div>
    </article>`;
  }).join("");
}

async function loadMemberships() {
  showStatus(listStatus, "Loading membership records…");
  const pageSize = 1000;
  const records = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("memberships")
      .select("id, user_id, first_name, last_name, email, phone, customer_category, status, start_date, expiry_date, source, legacy_key, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      showStatus(listStatus, authErrorMessage(error, "Unable to load memberships."), "error");
      return;
    }

    records.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  memberships = records;
  exportButton.disabled = memberships.length === 0;
  showStatus(listStatus, "");
  renderMemberships();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, (cells[index] || "").trim()])
  ));
}

function parseLegacyDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${second}+11:00`;
}

function legacyKey(record, rowNumber) {
  return [record["First Name"], record["Last Name"], record.Email, record["Primary Phone"], record["Creation Date"]]
    .map((value) => String(value || "").trim().toLowerCase())
    .concat(String(rowNumber))
    .join("|");
}

function prepareLegacyMembers(records) {
  return records
    .map((record, index) => ({
      first_name: record["First Name"] || "",
      last_name: record["Last Name"] || "",
      email: record.Email ? record.Email.toLowerCase() : null,
      phone: record["Primary Phone"] || record["Secondary Phone"] || null,
      customer_category: record.Category || "Regular",
      status: "pending",
      start_date: null,
      expiry_date: null,
      source: "legacy_csv",
      legacy_key: legacyKey(record, index + 2),
      legacy_created_at: parseLegacyDate(record["Creation Date"])
    }));
}

async function importPreparedMembers() {
  if (!preparedImports.length) return;
  importButton.disabled = true;
  importButton.textContent = "Importing…";
  showStatus(importStatus, "Checking existing membership records…");

  try {
    const chunkSize = 100;
    for (let index = 0; index < preparedImports.length; index += chunkSize) {
      const chunk = preparedImports.slice(index, index + chunkSize);
      const { error } = await supabase
        .from("memberships")
        .upsert(chunk, { onConflict: "legacy_key" });
      if (error) throw error;
      showStatus(importStatus, `Imported ${Math.min(index + chunk.length, preparedImports.length)} of ${preparedImports.length} customers…`);
    }

    showStatus(importStatus, `${preparedImports.length} customer records imported or updated.`, "success");
    await loadMemberships();
  } catch (error) {
    showStatus(importStatus, authErrorMessage(error, "Unable to import the customer list."), "error");
  } finally {
    importButton.disabled = false;
    importButton.textContent = "Import customers";
  }
}

async function updateMembership(membership, action, item) {
  const today = todayIso();
  let changes = {};

  if (action === "activate") {
    const usableStart = membership.start_date || today;
    const usableExpiry = membership.expiry_date && membership.expiry_date >= today
      ? membership.expiry_date
      : addOneYear(usableStart);
    changes = { status: "active", start_date: usableStart, expiry_date: usableExpiry };
  } else if (action === "renew") {
    const renewalBase = membership.expiry_date && membership.expiry_date >= today
      ? membership.expiry_date
      : today;
    changes = {
      status: "active",
      start_date: membership.start_date || today,
      expiry_date: addOneYear(renewalBase)
    };
  } else if (action === "suspend") {
    changes = { status: "suspended" };
  } else if (action === "cancel") {
    changes = { status: "cancelled" };
  } else if (action === "save-dates") {
    changes = {
      start_date: item.querySelector('[data-membership-field="start_date"]').value || null,
      expiry_date: item.querySelector('[data-membership-field="expiry_date"]').value || null
    };
    if (changes.start_date && changes.expiry_date && changes.expiry_date < changes.start_date) {
      showStatus(listStatus, "Expiry date cannot be earlier than the start date.", "error");
      return;
    }
  }

  showStatus(listStatus, `Updating ${memberName(membership)}…`);
  const { error } = await supabase.from("memberships").update(changes).eq("id", membership.id);
  if (error) {
    showStatus(listStatus, authErrorMessage(error, "Unable to update this membership."), "error");
    return;
  }

  showStatus(listStatus, `${memberName(membership)} was updated.`, "success");
  await loadMemberships();
}

export function initMembershipAdmin() {
  if (initialized) return;
  initialized = true;

  searchInput.addEventListener("input", renderMemberships);
  document.getElementById("refreshMemberships").addEventListener("click", loadMemberships);
  exportButton.addEventListener("click", exportMembershipsCsv);

  csvInput.addEventListener("change", async () => {
    const file = csvInput.files[0];
    preparedImports = [];
    importButton.disabled = true;
    if (!file) {
      csvMeta.textContent = "No file selected";
      showStatus(importStatus, "");
      return;
    }

    try {
      const records = parseCsv(await file.text());
      preparedImports = prepareLegacyMembers(records);
      const withEmail = preparedImports.filter((record) => record.email).length;
      csvMeta.textContent = `${file.name} · ${records.length} customer rows`;
      showStatus(importStatus, `${preparedImports.length} customer rows ready: ${withEmail} with email and ${preparedImports.length - withEmail} without email.`, preparedImports.length ? "success" : "error");
      importButton.disabled = !preparedImports.length;
    } catch (error) {
      showStatus(importStatus, "Unable to read this CSV file.", "error");
    }
  });

  importButton.addEventListener("click", importPreparedMembers);

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-membership-action]");
    if (!button) return;
    const item = button.closest("[data-membership-id]");
    const membership = memberships.find((candidate) => candidate.id === item.dataset.membershipId);
    if (!membership) return;

    button.disabled = true;
    await updateMembership(membership, button.dataset.membershipAction, item);
    button.disabled = false;
  });

  loadMemberships();
}
