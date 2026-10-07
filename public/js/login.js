const form = document.getElementById('auth-form');
const title = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const switchBtn = document.getElementById('switch-btn');
const switchText = document.getElementById('switch-text');
const pwHint = document.getElementById('pw-hint');
const formError = document.getElementById('form-error');
let mode = 'login'; // 'login' or 'register'

// Already logged in? Skip the form.
fetch('/api/auth/me').then(r => { if (r.ok) location.href = '/'; }).catch(() => {});

function setMode(next) {
  mode = next;
  const login = mode === 'login';
  title.textContent = login ? 'Log in' : 'Create account';
  submitBtn.textContent = login ? 'Log in' : 'Register';
  switchText.textContent = login ? 'No account yet?' : 'Already registered?';
  switchBtn.textContent = login ? 'Register' : 'Log in';
  pwHint.hidden = login;
  form.elements.password.autocomplete = login ? 'current-password' : 'new-password';
  clearErrors();
}

function setError(name, message) {
  const p = document.getElementById(`err-${name}`);
  const input = form.elements[name];
  p.textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function clearErrors() {
  ['username', 'password'].forEach(n => setError(n, ''));
  formError.textContent = '';
}

// Quick checks before sending anything; the server checks again
function validate({ username, password }) {
  let ok = true;
  if (!username.trim()) { setError('username', 'Enter your username'); ok = false; }
  else if (mode === 'register' && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    setError('username', '3 to 30 letters, numbers or underscores'); ok = false;
  }
  if (!password) { setError('password', 'Enter your password'); ok = false; }
  else if (mode === 'register' && password.length < 8) {
    setError('password', 'At least 8 characters'); ok = false;
  }
  return ok;
}

form.addEventListener('submit', async e => {
  e.preventDefault();                        // no page reload
  clearErrors();
  const data = Object.fromEntries(new FormData(form));
  if (!validate(data)) return;

  submitBtn.disabled = true;                 // loading state
  const label = submitBtn.textContent;
  submitBtn.textContent = 'Please wait\u2026';
  try {
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { location.href = '/'; return; }   // success: cookie is already set
    const body = await res.json().catch(() => ({}));
    if (body.fields) {
      Object.entries(body.fields).forEach(([k, m]) => setError(k, m));
    } else {
      formError.textContent = body.error || 'Something went wrong. Please try again.';
    }
  } catch {
    formError.textContent = 'Cannot reach the server. Check your connection.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = label;
  }
});

switchBtn.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
form.addEventListener('input', e => setError(e.target.name, ''));  // clear an error once the user edits