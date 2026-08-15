import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

let client = null;

export class WineBankTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "WineBankTimeoutError";
  }
}

export function withTimeout(value, ms = 12000, label = "Supabase request") {
  return Promise.race([
    Promise.resolve(value),
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new WineBankTimeoutError(`${label} timed out after ${Math.round(ms / 1000)} seconds.`));
      }, ms);
    })
  ]);
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase project URL or publishable key is missing.");
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error(
      "The Supabase browser library did not load. Check your internet connection, then refresh the page."
    );
  }

  if (!client) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "winebank-auth"
      }
    });
  }

  return client;
}

export async function getVerifiedUser(supabaseClient = getSupabaseClient()) {
  const { data: sessionData, error: sessionError } = await withTimeout(
    supabaseClient.auth.getSession(),
    10000,
    "Session check"
  );

  if (sessionError) throw sessionError;
  if (!sessionData?.session?.user) return null;

  const { data: userData, error: userError } = await withTimeout(
    supabaseClient.auth.getUser(),
    10000,
    "User verification"
  );

  if (userError) throw userError;
  return userData?.user || null;
}

export async function checkAdminAccess(supabaseClient, userId) {
  if (!userId) return { isAdmin: false, source: "none" };

  // Newer setup.sql installs this function. If an older database setup is in
  // use, fall back to the existing admin_users self-check policy.
  try {
    const { data, error } = await withTimeout(
      supabaseClient.rpc("is_admin"),
      10000,
      "Administrator role check"
    );

    if (!error && typeof data === "boolean") {
      return { isAdmin: data, source: "rpc" };
    }
  } catch (error) {
    if (error instanceof WineBankTimeoutError) throw error;
  }

  const { data, error } = await withTimeout(
    supabaseClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    10000,
    "Administrator table check"
  );

  if (error) throw error;
  return { isAdmin: Boolean(data), source: "table" };
}

export function friendlySupabaseError(error, fallback = "Something went wrong.") {
  if (!error) return fallback;
  if (error instanceof WineBankTimeoutError) return error.message;

  const message = String(error.message || error.error_description || fallback);

  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Could not reach Supabase. Check your internet connection and project URL, then try again.";
  }
  if (/invalid api key|apikey/i.test(message)) {
    return "Supabase rejected the publishable key. Check the project API key configuration.";
  }
  if (/row-level security|rls|policy/i.test(message)) {
    return "Supabase blocked this action with a database security policy. Check the WineBank admin RLS setup.";
  }
  if (/bucket.*not found|not found.*bucket/i.test(message)) {
    return "The menu-pdfs Storage bucket could not be found. Run the supplied Supabase setup SQL.";
  }
  if (/jwt|session|refresh token/i.test(message)) {
    return "Your login session is no longer valid. Please sign in again.";
  }

  return message;
}
