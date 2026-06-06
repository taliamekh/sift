// Sign-in card + nav widget for sift's email + password auth.
//
// One card hosts both Sign in and Sign up — toggling tabs at the top switches
// the submit handler and button label, no full re-render needed. Forgot
// password sends a reset email and returns the visitor to /sift/ where the
// updated session will be picked up by detectSessionInUrl.
//
// `mountNavAuth` keeps the topbar widget in sync via onAuthStateChange.

import { h } from './h.js';
import { supabase, currentUser, onAuthChange } from './supabase.js';
import * as toast from './toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const MAIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// Render a self-contained sign-in / sign-up card.
export function SignInCard({ onSignedIn } = {}) {
  const card = h('section.signin-card');

  // Mode toggle — tabs at the top of the card
  const tabs = h('div.signin-tabs', { role: 'tablist' });
  const signInTab = h('button.signin-tab', { type: 'button', role: 'tab', 'aria-selected': 'true' }, 'Sign in');
  const signUpTab = h('button.signin-tab', { type: 'button', role: 'tab', 'aria-selected': 'false' }, 'Sign up');
  tabs.appendChild(signInTab);
  tabs.appendChild(signUpTab);
  card.appendChild(tabs);

  // Form
  const form = h('form.signin-form');

  const emailField = h('label.signin-field');
  emailField.appendChild(h('span.signin-label', 'Email'));
  const emailWrap = h('div.input-icon');
  const emailGlyph = h('span.input-icon-glyph', { 'aria-hidden': 'true' });
  emailGlyph.innerHTML = MAIL_SVG;
  emailWrap.appendChild(emailGlyph);
  const emailInput = h('input.input', {
    type: 'email',
    name: 'email',
    placeholder: 'you@example.com',
    autocomplete: 'email',
    required: '',
  });
  emailWrap.appendChild(emailInput);
  emailField.appendChild(emailWrap);
  form.appendChild(emailField);

  const passwordField = h('label.signin-field');
  const passwordLabelRow = h('div.signin-field-row');
  passwordLabelRow.appendChild(h('span.signin-label', 'Password'));
  const forgot = h('button.signin-forgot', { type: 'button' }, 'Forgot?');
  passwordLabelRow.appendChild(forgot);
  passwordField.appendChild(passwordLabelRow);
  const passwordWrap = h('div.input-icon');
  const passwordGlyph = h('span.input-icon-glyph', { 'aria-hidden': 'true' });
  passwordGlyph.innerHTML = LOCK_SVG;
  passwordWrap.appendChild(passwordGlyph);
  const passwordInput = h('input.input', {
    type: 'password',
    name: 'password',
    placeholder: '••••••••',
    autocomplete: 'current-password',
    required: '',
    minlength: String(MIN_PASSWORD),
  });
  passwordWrap.appendChild(passwordInput);
  passwordField.appendChild(passwordWrap);
  form.appendChild(passwordField);

  const submit = h('button.btn.btn-primary.btn-lg.signin-submit', { type: 'submit' }, 'Sign in');
  form.appendChild(submit);

  const status = h('p.signin-status', { 'aria-live': 'polite' });
  form.appendChild(status);

  card.appendChild(form);

  // Mode state — 'signin' or 'signup'
  let mode = 'signin';
  function setMode(next) {
    mode = next;
    const isSignIn = mode === 'signin';
    signInTab.setAttribute('aria-selected', String(isSignIn));
    signUpTab.setAttribute('aria-selected', String(!isSignIn));
    submit.textContent = isSignIn ? 'Sign in' : 'Create account';
    forgot.hidden = !isSignIn;
    passwordInput.setAttribute('autocomplete', isSignIn ? 'current-password' : 'new-password');
    status.textContent = '';
    delete status.dataset.state;
  }
  signInTab.addEventListener('click', () => setMode('signin'));
  signUpTab.addEventListener('click', () => setMode('signup'));

  // Forgot password — sends a reset email and switches the status line to a
  // success note. The reset link drops the user back at /sift/ where the
  // Supabase client picks up the recovery session.
  forgot.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!EMAIL_RE.test(email)) {
      status.dataset.state = 'error';
      status.textContent = 'Enter your email above first.';
      emailInput.focus();
      return;
    }
    forgot.disabled = true;
    status.dataset.state = 'pending';
    status.textContent = 'Sending reset link…';
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    forgot.disabled = false;
    if (error) {
      status.dataset.state = 'error';
      status.textContent = error.message;
      return;
    }
    status.dataset.state = 'success';
    status.textContent = `Check ${email} for a password reset link.`;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!EMAIL_RE.test(email)) {
      status.dataset.state = 'error';
      status.textContent = 'Please enter a valid email address.';
      return;
    }
    if (password.length < MIN_PASSWORD) {
      status.dataset.state = 'error';
      status.textContent = `Password must be at least ${MIN_PASSWORD} characters.`;
      return;
    }
    submit.disabled = true;
    status.dataset.state = 'pending';
    status.textContent = mode === 'signin' ? 'Signing in…' : 'Creating your account…';

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      submit.disabled = false;
      if (error) {
        status.dataset.state = 'error';
        status.textContent = error.message;
        return;
      }
      status.dataset.state = 'success';
      status.textContent = 'Signed in.';
      if (typeof onSignedIn === 'function') {
        const user = await currentUser();
        if (user) onSignedIn(user);
      }
      return;
    }

    // Sign-up path. Supabase defaults to requiring email confirmation; if so,
    // the session is null after signUp and the user must click the link in
    // their inbox before signInWithPassword will succeed.
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectTo },
    });
    submit.disabled = false;
    if (error) {
      status.dataset.state = 'error';
      status.textContent = error.message;
      return;
    }
    if (data.session) {
      status.dataset.state = 'success';
      status.textContent = 'Account created — you’re signed in.';
      if (typeof onSignedIn === 'function') onSignedIn(data.user);
    } else {
      status.dataset.state = 'success';
      status.textContent = `Check ${email} to confirm your address, then come back and sign in.`;
      setMode('signin');
    }
  });

  return card;
}

// Topbar widget — shows "Sign in" when signed out, "{email} · Sign out"
// when signed in.
export function mountNavAuth(slot) {
  if (!slot) return;
  slot.hidden = false;

  function render(user) {
    slot.replaceChildren();
    if (!user) {
      const link = h('a.nav-link.nav-signin', { href: '#/signin' }, 'Sign in');
      slot.appendChild(link);
      return;
    }
    const label = h('span.nav-user', { title: user.email || 'Signed in' }, user.email || 'Signed in');
    const out = h('button.nav-link.nav-signout', { type: 'button' }, 'Sign out');
    out.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) toast.error('Sign out failed: ' + error.message);
      else toast.success('Signed out.');
    });
    slot.appendChild(label);
    slot.appendChild(out);
  }

  currentUser().then(render);
  onAuthChange(render);
}
