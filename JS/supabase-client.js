import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  hasSupabaseConfig
} from "./supabase-config.js";

export const isSupabaseConfigured = hasSupabaseConfig();

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function pageUrl(path) {
  return new URL(path, window.location.href).href;
}

export function authErrorMessage(error, fallback = "The request could not be completed.") {
  if (!error) return fallback;

  const message = String(error.message || error).trim();
  const status = error.status || error.statusCode;
  const details = [status ? `HTTP ${status}` : "", message].filter(Boolean).join(": ");

  if (status === 504 || /gateway timeout|timed out|timeout/i.test(message)) {
    return `${details || "HTTP 504"}. Supabase Auth timed out, usually while contacting its email/SMTP service. Check Supabase Auth logs and SMTP settings.`;
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return `${details}. Check your internet connection, Supabase project status, and browser console.`;
  }

  return details || fallback;
}
