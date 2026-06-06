// Singleton Supabase client + auth helpers.
//
// We load the SDK from esm.sh so we keep the no-build-step setup of the
// original sift app. The publishable key is safe to ship in client code —
// row-level security on every table + storage path enforces "you can only
// touch your own data". The same singleton client is imported by lib/api.js
// (for table reads/writes) and views (for sign-in/out and auth state).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist session in localStorage so refresh + reopen keep the user
    // signed in. detectSessionInUrl lets the magic-link redirect drop the
    // user back on /sift/#/ with a hash fragment that the SDK parses.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sift.auth',
  },
});

// Resolves to the current user (or null). Reads cached session synchronously
// first — Supabase rehydrates from localStorage on createClient — and then
// awaits the live session for the no-cache case (first page load post sign-in).
export async function currentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user || null;
}

// Promise that resolves to true if signed in, false otherwise. Used by
// views that want to gate UI on auth before they render.
export async function isSignedIn() {
  return !!(await currentUser());
}

// Subscribe to auth state changes. Returns the unsubscribe handle so views
// can clean up.
export function onAuthChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    handler(session?.user || null, event);
  });
  return () => data.subscription.unsubscribe();
}

// Throws a structured error any view can catch and show as "please sign in".
// Lets the api.js methods stay terse — they call this once at the top.
export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    const err = new Error('Sign in to use your cookbook.');
    err.code = 'NOT_AUTHENTICATED';
    throw err;
  }
  return user;
}
