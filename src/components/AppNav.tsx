"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app", label: "Overview" },
  { href: "/app/new", label: "New run" },
  { href: "/app/compare", label: "Compare" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/settings", label: "Settings" },
];

export default function AppNav() {
  const path = usePathname();
  return (
    <nav className="appnav">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          /* /app matches everything under it, so it is the current tab only
             when it is exactly the overview */
          aria-current={t.href === "/app" ? (path === "/app" ? "page" : undefined)
                                          : path.startsWith(t.href) ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
