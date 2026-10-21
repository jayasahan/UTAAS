import { NavLink, Outlet } from 'react-router-dom';

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requests', label: 'My Applications', end: true },
  { to: '/requests/new', label: 'New Application', end: true },
];

export function AppLayout() {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="bg-brand px-6 py-7 text-white">
        <p className="text-3xl font-bold tracking-wide">UTAAS</p>
        <p className="mt-2 text-sm text-slate-200">University administration</p>
        <nav
          aria-label="Main navigation"
          className="mt-8 flex flex-wrap gap-2 md:flex-col"
        >
          {navigation.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-3 text-sm font-medium ${isActive ? 'bg-white text-brand' : 'text-slate-100 hover:bg-white/10'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white px-6 py-6 text-sm text-brand md:px-10">
          University of Ruhuna / Faculty Administration
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-6 py-10 md:px-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
