import { useEffect, useSyncExternalStore } from "react";

export type AuthProvider = "google" | "email";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  handle: string | null;
  preferredTools: string[];
  provider: AuthProvider;
  createdAt: string;
};

type State = {
  user: AuthUser | null;
  loading: boolean;
  isFirstSignIn: boolean;
  modal: {
    open: boolean;
    returnTo: string | null;
  };
};

const USER_KEY = "uiuxofai.user";
const WELCOME_KEY = "uiuxofai.welcomeSeen";

function readUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && parsed.id && parsed.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

let state: State = {
  user: readUser(),
  loading: false,
  isFirstSignIn: false,
  modal: { open: false, returnTo: null },
};

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn());
}

function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}

function getSnapshot(): State {
  return state;
}

function getServerSnapshot(): State {
  return {
    user: null,
    loading: false,
    isFirstSignIn: false,
    modal: { open: false, returnTo: null },
  };
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAuthModal() {
  const s = useAuth();
  return {
    isOpen: s.modal.open,
    returnTo: s.modal.returnTo,
    open: openAuthModal,
    close: closeAuthModal,
  };
}

export function openAuthModal(returnTo: string | null = null) {
  setState({ modal: { open: true, returnTo } });
}

export function closeAuthModal() {
  setState({ modal: { open: false, returnTo: null } });
}

function avatarFor(seed: string): string | null {
  // Inline SVG data URI as a deterministic, network-free avatar.
  const colors = ["#8B7BFF", "#C5E96A", "#E0B868", "#6CC9E4"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const c = colors[h % colors.length];
  const initial = seed.charAt(0).toUpperCase() || "U";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='${c}'/><text x='50%' y='55%' text-anchor='middle' dominant-baseline='middle' font-family='Inter,system-ui,sans-serif' font-weight='600' font-size='14' fill='#0A0A0B'>${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "designer";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 32) || "Designer";
}

async function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Mock Google sign-in. Always succeeds. */
export async function mockSignInGoogle(): Promise<AuthUser> {
  setState({ loading: true });
  await delay(650);
  const email = "you@google.com";
  return finishSignIn({
    id: "mock-google",
    email,
    displayName: "Designer",
    avatarUrl: avatarFor("D"),
    handle: null,
    preferredTools: [],
    provider: "google",
    createdAt: new Date().toISOString(),
  });
}

/** Mock magic-link sign-in. Always succeeds after the "click". */
export async function mockSignInEmail(email: string): Promise<AuthUser> {
  setState({ loading: true });
  await delay(650);
  const name = nameFromEmail(email);
  return finishSignIn({
    id: `mock-${email}`,
    email,
    displayName: name,
    avatarUrl: avatarFor(name),
    handle: null,
    preferredTools: [],
    provider: "email",
    createdAt: new Date().toISOString(),
  });
}

function finishSignIn(user: AuthUser): AuthUser {
  const welcomeSeen =
    typeof window !== "undefined" && window.localStorage.getItem(WELCOME_KEY) === "1";
  writeUser(user);
  setState({
    user,
    loading: false,
    isFirstSignIn: !welcomeSeen,
    modal: { open: false, returnTo: null },
  });
  return user;
}

export function signOut() {
  writeUser(null);
  setState({ user: null, isFirstSignIn: false });
}

export function markWelcomeSeen() {
  if (typeof window !== "undefined") window.localStorage.setItem(WELCOME_KEY, "1");
  setState({ isFirstSignIn: false });
}

/**
 * Compute where to send a user after a successful sign-in.
 * Single source of truth used by both the modal and /login page.
 */
export function postAuthDestination(returnTo: string | null | undefined): string {
  const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/generate";
  const welcomeSeen =
    typeof window !== "undefined" && window.localStorage.getItem(WELCOME_KEY) === "1";
  if (!welcomeSeen) return `/welcome?returnTo=${encodeURIComponent(dest)}`;
  return dest;
}

export function updateProfile(patch: Partial<Pick<AuthUser, "displayName" | "handle" | "preferredTools">>) {
  if (!state.user) return;
  const next: AuthUser = { ...state.user, ...patch };
  if (patch.displayName) next.avatarUrl = avatarFor(patch.displayName);
  writeUser(next);
  setState({ user: next });
}

/** Sync state across tabs. */
export function useAuthStorageSync() {
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== USER_KEY) return;
      setState({ user: readUser() });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
