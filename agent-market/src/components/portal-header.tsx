import type { NavItem } from "../lib/portal-types";

interface PortalHeaderProps {
  navItems: NavItem[];
}

export function PortalHeader({ navItems }: PortalHeaderProps) {
  return (
    <header className="portal-header">
      <a className="portal-brand" href="#top">
        ClawOS Agent Market
      </a>
      <nav className="portal-nav" aria-label="市场主导航">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
