#!/usr/bin/env node
/**
 * Applies the Supabase Auth settings SettleNG needs, using the Supabase Management API:
 *
 *   1. mailer_autoconfirm = true  -> registration no longer depends on a confirmation email.
 *      Signing up returns a session immediately, so the app can go straight to the dashboard.
 *   2. site_url + uri_allow_list  -> email links (password recovery, etc.) point at the real
 *      deployment instead of localhost:3000.
 *   3. optional CAPTCHA           -> with --turnstile-secret, Supabase enforces the CAPTCHA on
 *      sign-up, sign-in and password reset on its own side, before any account is created.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-auth-config.mjs
 *   node scripts/supabase-auth-config.mjs --turnstile-secret=0x4AAAA...
 *
 * The token is a Supabase *personal access token* (Account -> Access Tokens). It is not the anon
 * or service_role key. It can also be placed in scripts/.supabase-token (gitignored).
 *
 * Options:
 *   --check                 print the current settings and change nothing
 *   --turnstile-secret=...  enable CAPTCHA with a Cloudflare Turnstile secret key
 *   --hcaptcha-secret=...   enable CAPTCHA with an hCaptcha secret key
 *   --site-url=...          override the site URL (default https://settleng.vercel.app)
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://api.supabase.com/v1";
const DEFAULT_SITE_URL = "https://settleng.vercel.app";
/** Redirect targets Supabase will accept. Without these it silently swaps in the Site URL. */
const DEFAULT_REDIRECTS = [
  "https://settleng.vercel.app/**",
  "https://settleng-*.vercel.app/**",
  "http://localhost:3000/**",
];

const args = process.argv.slice(2);
const flag = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const [, value] = hit.split("=");
  return value ?? true;
};

function readToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const file = path.join("scripts", ".supabase-token");
  if (fs.existsSync(file)) {
    const value = fs.readFileSync(file, "utf8").trim();
    if (value) return value;
  }
  return null;
}

/** The project ref is the first label of the Supabase URL: https://<ref>.supabase.co */
function readProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF.trim();
  for (const file of ["web/.env.local", "web/.env", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const match = fs.readFileSync(file, "utf8").match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
    if (match) return match[1];
  }
  return null;
}

const token = readToken();
if (!token) {
  console.error(
    "No Supabase access token.\n\n" +
      "Create one at https://supabase.com/dashboard/account/tokens and either:\n" +
      "  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-auth-config.mjs\n" +
      "or save it (single line) to scripts/.supabase-token\n\n" +
      "This token is an account-level personal access token, not the anon or service_role key.",
  );
  process.exit(1);
}

const ref = readProjectRef();
if (!ref) {
  console.error("Could not work out the Supabase project ref. Set SUPABASE_PROJECT_REF=... and retry.");
  process.exit(1);
}

/** The handful of fields we read or write, so no secrets are ever printed. */
const SAFE_FIELDS = [
  "mailer_autoconfirm",
  "site_url",
  "uri_allow_list",
  "security_captcha_enabled",
  "security_captcha_provider",
];

async function call(method, body) {
  const response = await fetch(`${API}/projects/${ref}/config/auth`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const detail = json?.message ?? text.slice(0, 300) ?? "";
    throw new Error(`${method} ${response.status}: ${detail}`);
  }
  return json ?? {};
}

function summarise(label, config) {
  console.log(`\n${label}`);
  for (const key of SAFE_FIELDS) console.log(`  ${key}: ${JSON.stringify(config[key] ?? null)}`);
}

const siteUrl = flag("site-url") || DEFAULT_SITE_URL;
const captchaSecret = flag("turnstile-secret") || flag("hcaptcha-secret");
const captchaProvider = flag("turnstile-secret") ? "turnstile" : flag("hcaptcha-secret") ? "hcaptcha" : null;

try {
  const before = await call("GET");
  summarise(`Current auth config for project ${ref}`, before);

  if (flag("check")) {
    console.log("\n--check: nothing was changed.");
    process.exit(0);
  }

  const patch = {
    // Registration must not wait on an email. This is the switch that makes signUp() return a
    // session straight away.
    mailer_autoconfirm: true,
    site_url: siteUrl,
    uri_allow_list: DEFAULT_REDIRECTS.join(","),
  };
  if (captchaProvider && typeof captchaSecret === "string") {
    patch.security_captcha_enabled = true;
    patch.security_captcha_provider = captchaProvider;
    patch.security_captcha_secret = captchaSecret;
  }

  const after = await call("PATCH", patch);
  const verified = SAFE_FIELDS.some((k) => k in after) ? after : await call("GET");
  summarise("Updated auth config", verified);

  const ok = verified.mailer_autoconfirm === true && verified.site_url === siteUrl;
  if (!ok) {
    console.error(
      "\nThe settings did not stick. Check that the token has access to this project and try again.",
    );
    process.exit(1);
  }
  console.log(
    "\nDone. Email confirmation is no longer required, and links point at " +
      siteUrl +
      ".\nTry signing up on the site — you should land on the dashboard without any email.",
  );
  if (!captchaProvider) {
    console.log(
      "CAPTCHA is still off. Add --turnstile-secret=... (and NEXT_PUBLIC_TURNSTILE_SITE_KEY in\n" +
        "Vercel) to switch it on.",
    );
  }
} catch (error) {
  console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
