"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: string;
  children?: NavItem[];
  /** If set, only these cookie role values will see this item */
  roles?: string[];
}

const NAV: NavItem[] = [
  {
    label: "Supra Pacific",
    icon: "🏢",
    children: [
      {
        label: "Gold Loan",
        href: "/dashboard/supra/gold-loan",
        icon: "🏅",
      },
      {
        label: "Upload Data",
        href: "/dashboard/supra/gold-loan/upload",
        icon: "⬆️",
        roles: ["admin", "supra_employee"],
      },
    ],
  },
];

function useRole(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )role=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function NavLink({
  item,
  depth = 0,
  role,
}: {
  item: NavItem;
  depth?: number;
  role: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  // Role filter
  if (item.roles && (!role || !item.roles.includes(role))) return null;

  const isActive = item.href ? pathname.startsWith(item.href) : false;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:bg-white/10 transition"
        >
          <span>{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <span className="text-xs text-gray-500">{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div className="ml-3 border-l border-white/10 pl-2 mt-0.5 space-y-0.5">
            {item.children.map((child) => (
              <NavLink key={child.label} item={child} depth={depth + 1} role={role} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
        isActive
          ? "bg-white/15 text-white font-semibold"
          : "text-gray-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
    </Link>
  );
}

export default function Sidebar() {
  const role = useRole();

  return (
    <aside className="w-60 min-h-screen bg-[#0f172a] flex flex-col px-3 py-6">
      {/* Logo */}
      <div className="px-3 mb-8">
        <p className="text-white font-bold text-lg tracking-tight">Companies</p>
        <p className="text-gray-500 text-xs">Management Dashboard</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => (
          <NavLink key={item.label} item={item} role={role} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-4 border-t border-white/10">
        <p className="text-xs text-gray-500">Supra Pacific · v1.0</p>
      </div>
    </aside>
  );
}
