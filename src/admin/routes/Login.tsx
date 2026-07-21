import { useMemo, useRef, useState, type FormEvent } from 'react';
import { driver, isDemo, useEmployees } from '../lib/useDriver';
import { Button, Field, Panel, Select, TextInput } from '../ui';

// Wave-2 login gate.
//  • LIVE mode: LOGIN ID (AP-ADMIN / AP-EMP1…5) + password → signInWithLoginId.
//  • DEMO mode: two paths — Admin passphrase (AP-ADMIN) AND Employee (pick from roster + PIN).
// The signed-in state + role-based redirect are handled by the Shell's onAuth subscription,
// so this screen only needs to complete the sign-in.
export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Panel className="w-full max-w-sm p-7">
        <div className="text-center">
          <img src="/logo.png" alt="Autopalette" className="mx-auto h-12 w-auto" />
          <h1 className="mt-4 font-display text-xl font-bold uppercase tracking-widest text-goldBright">
            {isDemo ? 'Studio Login' : 'Admin'}
          </h1>
          <p className="mt-1 font-ui text-xs tracking-wide text-white/45">
            Autopalette Studio · Sign in to continue
          </p>
        </div>

        {isDemo ? <DemoLogin /> : <LiveLogin />}

        <p className="mt-5 text-center font-body text-[0.7rem] text-white/30">
          <a href="/" className="transition-colors hover:text-white/60">
            ← Back to autopalette.in
          </a>
        </p>
      </Panel>
    </main>
  );
}

// --- LIVE: login id + password ----------------------------------------------------------

function LiveLogin() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await driver.signInWithLoginId(loginId.trim(), password);
      // Shell redirects on the resulting onAuth update.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      firstRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
      <Field label="Login ID">
        {(id) => (
          <TextInput
            id={id}
            ref={firstRef}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="AP-ADMIN / AP-EMP1…"
            autoComplete="username"
            autoCapitalize="characters"
            required
            autoFocus
          />
        )}
      </Field>
      <Field label="Password">
        {(id) => (
          <TextInput
            id={id}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-describedby={error ? 'login-error' : undefined}
          />
        )}
      </Field>
      {error && (
        <p id="login-error" role="alert" className="font-body text-xs text-pinstripe-red">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}

// --- DEMO: admin passphrase OR employee (roster + PIN) ----------------------------------

type DemoTab = 'admin' | 'employee';

function DemoLogin() {
  const [tab, setTab] = useState<DemoTab>('admin');

  return (
    <>
      <div className="mt-5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-center">
        <p className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-goldBright">
          Demo Mode
        </p>
        <p className="mt-0.5 font-body text-[0.7rem] text-white/55">Data stays on this device.</p>
      </div>

      <div className="mt-4 flex rounded-lg border border-white/12 p-1" role="tablist" aria-label="Login as">
        {(['admin', 'employee'] as DemoTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 font-ui text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-gold/15 text-goldBright' : 'text-white/55 hover:text-white/85'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'admin' ? <DemoAdmin /> : <DemoEmployee />}
    </>
  );
}

function DemoAdmin() {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await driver.signInWithLoginId('AP-ADMIN', passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      ref.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
      <Field label="Admin Passphrase" hint="Login ID AP-ADMIN">
        {(id) => (
          <TextInput
            id={id}
            ref={ref}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
            required
            autoFocus
            aria-describedby={error ? 'demo-admin-error' : undefined}
          />
        )}
      </Field>
      {error && (
        <p id="demo-admin-error" role="alert" className="font-body text-xs text-pinstripe-red">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign In as Admin'}
      </Button>
    </form>
  );
}

function DemoEmployee() {
  const employees = useEmployees();
  const active = useMemo(() => (employees ?? []).filter((e) => e.active), [employees]);
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !loginId) return;
    setError(null);
    setBusy(true);
    try {
      await driver.signInWithLoginId(loginId, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (employees === null) {
    return <p className="mt-4 font-body text-sm text-white/45">Loading roster…</p>;
  }

  if (active.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-white/12 px-3 py-4 text-center font-body text-xs text-white/45">
        No active employees yet. An admin adds them under Employees first — each gets a login
        ID (AP-EMP1…) and a PIN.
      </p>
    );
  }

  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
      <Field label="Employee">
        {(id) => (
          <Select
            id={id}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            autoFocus
          >
            <option value="">Select…</option>
            {active.map((emp) => (
              <option key={emp.id} value={emp.loginId}>
                {emp.name || emp.loginId} ({emp.loginId})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="PIN" hint="Default = last 4 digits of phone, or 2468 if none set">
        {(id) => (
          <TextInput
            id={id}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="off"
            required
            aria-describedby={error ? 'demo-emp-error' : undefined}
          />
        )}
      </Field>
      {error && (
        <p id="demo-emp-error" role="alert" className="font-body text-xs text-pinstripe-red">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !loginId}>
        {busy ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
