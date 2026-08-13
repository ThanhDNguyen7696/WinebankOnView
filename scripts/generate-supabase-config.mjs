import { readFile, writeFile } from "node:fs/promises";

const envPath = process.argv[2] || ".env.local";
let contents;

try {
  contents = await readFile(envPath, "utf8");
} catch {
  contents = "";
}

const fileValues = Object.fromEntries(
  contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return separator === -1
        ? [line, ""]
        : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    })
);

const supabaseUrl = process.env.SUPABASE_URL || fileValues.SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || fileValues.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey || publishableKey.includes("PASTE_YOUR")) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local or the deployment environment."
  );
}

const output = `// Generated file. Do not edit or commit.\nexport const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(publishableKey)};\n\nexport const MENU_BUCKET = "menus";\nexport const MENU_PATH = "food/current-menu.pdf";\n\nexport function hasSupabaseConfig() {\n  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);\n}\n`;

await writeFile("JS/supabase-config.js", output, "utf8");
console.log("Generated JS/supabase-config.js");
