/**
 * Every link and route lookup in the site goes through this file.
 *
 * Today it wraps React Router. Lovable's current template uses TanStack Router (TanStack Start);
 * moving routers means changing only this file and the route table in App.tsx. Pages never import
 * a router package directly.
 */
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";

export function AppLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export function AppNavLink({
  to,
  end,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  className: (active: boolean) => string;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => className(isActive)}>
      {children}
    </NavLink>
  );
}

/** The optional second URL segment, e.g. "hood" in /model/hood. */
export function useSubTab(): string | undefined {
  return useParams().sub;
}

export function usePathname(): string {
  return useLocation().pathname;
}
