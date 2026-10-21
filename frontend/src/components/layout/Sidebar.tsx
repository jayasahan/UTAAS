import { NavLink } from 'react-router-dom';
export interface NavigationItem {
  to: string;
  label: string;
  end?: boolean;
}
export function Sidebar({
  items,
  portalLabel,
}: {
  items: readonly NavigationItem[];
  portalLabel: string;
}) {
  return (
    <aside className="focus-on-dark bg-brand px-6 py-7 text-white">
      <p className="text-3xl font-bold tracking-wide">UTAAS</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
        {portalLabel}
      </p>
      <nav
        aria-label="Main navigation"
        className="mt-8 flex flex-wrap gap-2 md:flex-col"
      >
        {items.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end ?? false}
            className={({ isActive }) =>
              `rounded-control px-3 py-3 text-sm font-semibold ${isActive ? 'bg-white text-brand' : 'text-slate-100 hover:bg-white/10'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
