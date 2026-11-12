import type { User } from "@supabase/supabase-js";

// Device-saved accounts used when the account service cannot start a session
// (e.g. email confirmation is required). Keeps sign-up / sign-in working.
const ACCOUNTS_KEY = "gs_local_accounts";
const CURRENT_KEY = "gs_local_current";

type LocalAccount = { pass: string; user: User };

async function hash(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function readAccounts(): Record<string, LocalAccount> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAccounts(a: Record<string, LocalAccount>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

const listeners = new Set<() => void>();
export function onLocalAuthChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((l) => l());
}

export function getLocalUser(): User | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(CURRENT_KEY);
  if (!email) return null;
  return readAccounts()[email]?.user ?? null;
}

export async function localSignUp(email: string, password: string, metadata: Record<string, unknown>) {
  const accounts = readAccounts();
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "local" },
    user_metadata: { ...metadata, email },
    created_at: now,
  } as unknown as User;
  accounts[email] = { pass: await hash(email + password), user };
  writeAccounts(accounts);
  localStorage.setItem(CURRENT_KEY, email);
  emit();
  return user;
}

export async function localSignIn(email: string, password: string) {
  const acc = readAccounts()[email];
  if (!acc || acc.pass !== (await hash(email + password))) return null;
  localStorage.setItem(CURRENT_KEY, email);
  emit();
  return acc.user;
}

export function localUpdateMetadata(patch: Record<string, unknown>) {
  const email = localStorage.getItem(CURRENT_KEY);
  if (!email) return;
  const accounts = readAccounts();
  const acc = accounts[email];
  if (!acc) return;
  acc.user = { ...acc.user, user_metadata: { ...acc.user.user_metadata, ...patch } } as User;
  writeAccounts(accounts);
  emit();
}

export function localSignOut() {
  localStorage.removeItem(CURRENT_KEY);
  emit();
}
