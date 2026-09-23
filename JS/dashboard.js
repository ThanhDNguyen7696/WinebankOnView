import {
  supabase,
  isSupabaseConfigured,
  pageUrl,
  hasAdminAccess,
  authErrorMessage
} from "./supabase-client.js";

const membershipLabels = {
  pending: "Pending",
  active: "Active",
  expired: "Expired",
  suspended: "Suspended",
  cancelled: "Cancelled"
};

const membershipDetails = {
  pending: "Awaiting staff confirmation",
  active: "Membership confirmed",
  expired: "Membership has expired",
  suspended: "Membership temporarily suspended",
  cancelled: "Membership cancelled"
};

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function effectiveMembershipStatus(membership) {
  if (!membership) return "pending";
  if (
    membership.status === "active" &&
    membership.expiry_date &&
    membership.expiry_date < new Date().toISOString().slice(0, 10)
  ) return "expired";
  return membership.status;
}

async function showMembership(user) {
  const badge = document.getElementById("membershipStatus");
  const detail = document.getElementById("membershipStatusDetail");
  const expiry = document.getElementById("membershipExpiry");
  const message = document.getElementById("membershipMessage");

  const { data, error } = await supabase
    .from("memberships")
    .select("status, start_date, expiry_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    message.textContent = authErrorMessage(error, "Membership details are temporarily unavailable.");
    return;
  }

  const status = effectiveMembershipStatus(data);
  badge.textContent = membershipLabels[status] || "Pending";
  badge.dataset.status = status;
  detail.textContent = membershipDetails[status] || membershipDetails.pending;
  expiry.textContent = formatDate(data?.expiry_date);

  if (status === "expired") {
    message.textContent = "Please contact WineBank staff to renew your membership.";
  } else if (status === "pending") {
    message.textContent = "Staff will confirm your membership status.";
  } else {
    message.textContent = "";
  }
}

if (!isSupabaseConfigured) {
  window.location.replace("./login.html");
} else {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    window.location.replace("./login.html");
  } else {
    const metadata = user.user_metadata || {};
    const emailName = (user.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    document.getElementById("memberName").textContent =
      metadata.first_name || emailName || "Member";
    document.getElementById("memberEmail").textContent =
      user.email || "Not provided";
    document.getElementById("memberPhone").textContent =
      metadata.phone || user.phone || "Not provided";

    try {
      await showMembership(user);
    } catch (membershipError) {
      console.error("Unable to display membership details.", membershipError);
    }

    try {
      if (await hasAdminAccess(user)) {
        document.getElementById("adminDashboardLink").hidden = false;
      }
    } catch (adminCheckError) {
      console.error("Unable to verify admin access.", adminCheckError);
    }

    document.getElementById("logoutButton").addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.replace(pageUrl("./login.html"));
    });
  }
}
