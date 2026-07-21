import { useEffect } from 'react';
import type { AuthState } from '../shared/data';
import { driver, isDemo, useAuth, useEmployees } from './lib/useDriver';
import { canLeave, navigate, useRoute, type Route } from './lib/router';
import { ToastProvider, Spinner } from './ui';
import Login from './routes/Login';
import DataPanel from './routes/DataPanel';
import BookingsInbox from './routes/BookingsInbox';
import BookingDetail from './routes/BookingDetail';
import JobcardsList from './routes/JobcardsList';
import JobcardEditor from './routes/JobcardEditor';
import Invoice from './routes/Invoice';
import Employees from './routes/Employees';
import DayBoard from './routes/DayBoard';
import MyDay from './routes/MyDay';
import Customers from './routes/Customers';
import CustomerDetail from './routes/CustomerDetail';

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

// Routes a signed-in STAFF member may reach. Everything else routes them to My Day.
const STAFF_ROUTES: Route['name'][] = ['myday'];

function isAdminAllowed(name: Route['name']): boolean {
  // Admin sees everything except the staff-personal My Day view and the login gate.
  return name !== 'myday' && name !== 'login' && name !== 'not-found';
}

function Shell() {
  const auth = useAuth();
  const route = useRoute();
  const signedIn = auth?.signedIn ?? false;
  const role = auth?.role ?? null;

  // Redirect based on auth state + role (in an effect — never mutate the hash during render).
  useEffect(() => {
    if (auth === undefined) return; // initial check in flight
    if (!signedIn) {
      if (route.name !== 'login') navigate('/login');
      return;
    }
    if (role === 'staff') {
      if (!STAFF_ROUTES.includes(route.name)) navigate('/myday');
      return;
    }
    // admin
    if (!isAdminAllowed(route.name)) navigate('/');
  }, [auth, signedIn, role, route.name]);

  if (auth === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner label="Starting admin…" />
      </main>
    );
  }

  if (!signedIn) {
    return <Login />;
  }

  return (
    <div className="min-h-screen">
      <NavBar route={route} auth={auth} />
      <RouteView route={route} role={role} />
    </div>
  );
}

function RouteView({ route, role }: { route: Route; role: AuthState['role'] }) {
  // Guard: staff only ever renders My Day; admin renders the rest. The redirect effect keeps
  // the hash in sync, but this switch is the hard gate on what actually mounts.
  if (role === 'staff') {
    return route.name === 'myday' ? <MyDay /> : null;
  }
  switch (route.name) {
    case 'home':
      return <DataPanel />;
    case 'bookings':
      return <BookingsInbox />;
    case 'booking-detail':
      return <BookingDetail id={route.params.id} />;
    case 'jobcards':
      return <JobcardsList />;
    case 'jobcard-editor':
      return <JobcardEditor id={route.params.id} />;
    case 'jobcard-invoice':
      return <Invoice id={route.params.id} />;
    case 'employees':
      return <Employees />;
    case 'dayboard':
      return <DayBoard />;
    case 'customers':
      return <Customers />;
    case 'customer-detail':
      return <CustomerDetail phone={route.params.phone} />;
    default:
      // 'login' / 'not-found' / 'myday' resolve via the redirect effect; render nothing.
      return null;
  }
}

function NavBar({ route, auth }: { route: Route; auth: AuthState }) {
  const staff = auth.role === 'staff';
  const employees = useEmployees();
  const me = staff && auth.employeeId ? employees?.find((e) => e.id === auth.employeeId) : undefined;

  async function signOut() {
    if (!canLeave()) return; // honors the editor's unsaved-changes guard
    await driver.adminSignOut();
    navigate('/login');
  }

  const onBookings = route.name === 'bookings' || route.name === 'booking-detail';
  const onJobcards =
    route.name === 'jobcards' || route.name === 'jobcard-editor' || route.name === 'jobcard-invoice';
  const onCustomers = route.name === 'customers' || route.name === 'customer-detail';

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-char/85 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Autopalette" className="h-7 w-auto" />
          <span className="hidden font-display text-sm font-bold uppercase tracking-widest text-goldBright sm:inline">
            {staff ? 'My Day' : 'Admin'}
          </span>
          {isDemo && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-ui text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-goldBright">
              Demo
            </span>
          )}
        </div>

        {staff ? (
          <span className="truncate font-ui text-xs text-white/55">
            {me?.name || 'Staff'} · <span className="text-white/35">{me?.loginId}</span>
          </span>
        ) : (
          <nav
            className="flex flex-1 items-center justify-center gap-1 overflow-x-auto"
            aria-label="Primary"
          >
            <NavLink label="Data" active={route.name === 'home'} onClick={() => navigate('/')} />
            <NavLink label="Bookings" active={onBookings} onClick={() => navigate('/bookings')} />
            <NavLink label="Job Cards" active={onJobcards} onClick={() => navigate('/jobcards')} />
            <NavLink
              label="Day Board"
              active={route.name === 'dayboard'}
              onClick={() => navigate('/dayboard')}
            />
            <NavLink label="Customers" active={onCustomers} onClick={() => navigate('/customers')} />
            <NavLink
              label="Employees"
              active={route.name === 'employees'}
              onClick={() => navigate('/employees')}
            />
          </nav>
        )}

        <button
          onClick={signOut}
          className="shrink-0 font-ui text-xs text-white/50 transition-colors hover:text-goldBright focus:outline-none focus-visible:text-goldBright"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function NavLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-ui text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
        active ? 'bg-gold/15 text-goldBright' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
      }`}
    >
      {label}
    </button>
  );
}
