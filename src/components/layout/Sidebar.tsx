"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "📊",
    roles: ["admin", "pharmacist_scheduler", "tech_supervisor", "read_only"],
  },
  {
    href: "/ratio",
    label: "Ratio",
    icon: "⚖️",
    roles: ["admin", "pharmacist_scheduler", "tech_supervisor", "pharmacist", "read_only"],
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: "🗓️",
    roles: ["admin", "pharmacist_scheduler", "tech_supervisor", "read_only"],
  },
  {
    href: "/my-schedule",
    label: "My Schedule",
    icon: "👤",
    roles: ["admin", "pharmacist_scheduler", "tech_supervisor", "pharmacist", "tech"],
  },
  {
    href: "/requests",
    label: "Requests",
    icon: "✉️",
    roles: ["admin", "pharmacist_scheduler", "tech_supervisor", "read_only"],
  },
  {
    href: "/setup",
    label: "Setup",
    icon: "⚙️",
    roles: ["admin"],
  },
];

export function Sidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden w-48 shrink-0 border-r border-gray-200 bg-white py-4 md:block">
        <ul className="space-y-1 px-2">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-optum-blue font-semibold text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white md:hidden">
        <ul className="flex justify-around">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                    active ? "font-semibold text-optum-blue" : "text-gray-500"
                  }`}
                >
                  <span className="text-base" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
