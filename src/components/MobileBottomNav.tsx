"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

type NavItem = {
  href: string;
  label: string;
  icon: "map" | "pin" | "plus" | "admin" | "congregation" | "timer";
  accent?: boolean;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Mapa", icon: "map" },
  { href: "/revisits/nearby", label: "Próximas", icon: "pin" },
  { href: "/revisits/new", label: "Nova", icon: "plus", accent: true },
  { href: "/pioneiro", label: "Pioneiro", icon: "timer" },
  { href: "/congregations", label: "Congregação", icon: "congregation", hideForAdmin: true },
  { href: "/admin", label: "Admin", icon: "admin", adminOnly: true },
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

  if (type === "timer") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M9.5 2.5h5" />
        <path d="M12 2.5V5" />
      </svg>
    );
  }

  if (type === "congregation") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 9.5L12 4l9 5.5V20H3V9.5Z" />
        <path d="M9 20v-6h6v6" />
        <path d="M12 4v3" />
      </svg>
    );
  }

  if (type === "admin") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        <path d="M16 11l1.5 1.5L20 10" />
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
  const role = useAuthStore((s) => s.role);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && role !== "ADMIN") return false;
    if (item.hideForAdmin && role === "ADMIN") return false;
    return true;
  });

  return (
    <nav className="mobile-nav" aria-label="Navegação principal">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
