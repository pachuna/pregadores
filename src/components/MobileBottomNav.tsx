"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: "map" | "pin" | "plus";
  accent?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Mapa", icon: "map" },
  { href: "/revisits/nearby", label: "Próximas", icon: "pin" },
  { href: "/revisits/new", label: "Nova", icon: "plus", accent: true },
];

function NavIcon({ type }: { type: NavItem["icon"] }) {
  if (type === "map") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 6.5L8.5 4L15.5 6.5L21 4V17.5L15.5 20L8.5 17.5L3 20V6.5Z" />
        <path d="M8.5 4V17.5" />
        <path d="M15.5 6.5V20" />
      </svg>
    );
  }

  if (type === "pin") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 21C12 21 19 14.4 19 9A7 7 0 1 0 5 9C5 14.4 12 21 12 21Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`mobile-nav__item ${
              isActive ? "mobile-nav__item--active" : ""
            } ${item.accent ? "mobile-nav__item--accent" : ""}`}
          >
            <span aria-hidden="true" className="mobile-nav__icon">
              <NavIcon type={item.icon} />
            </span>
            <span className="mobile-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
