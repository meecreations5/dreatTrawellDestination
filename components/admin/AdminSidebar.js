"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { useState } from "react";
import { adminSidebar } from "@/config/adminSidebar";
import Image from "next/image";

export default function AdminSidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const [open, setOpen] = useState({});

  const toggleGroup = label =>
    setOpen(p => ({ ...p, [label]: !p[label] }));

  return (
    <aside
      className={`
        fixed left-4 top-4 bottom-4
        flex flex-col justify-between
        rounded-2xl
        bg-[#FFFFFF]
        shadow-[0_10px_30px_rgba(0,0,0,0.06)]
        transition-all duration-300
        ${collapsed ? "w-[72px]" : "w-[280px]"}
      `}
    >
      {/* ───────── TOP ───────── */}
      <div className="px-3 pt-4">
        {/* LOGO */}
        <div className="flex justify-center pb-4">
          <Image
            src="/logo.png"   // or /logo.png
            alt="Logo"
            priority
            width={80}
            height={80}
          />
        </div>

        {/* NAV */}
        <nav className="space-y-2">
          {adminSidebar.map(item => {
            const Icon = item.icon;
            const hasChildren = !!item.children;

            const isActive =
              item.href && pathname.startsWith(item.href);

            const isChildActive =
              hasChildren &&
              item.children.some(c =>
                pathname.startsWith(c.href)
              );

            const active = isActive || isChildActive;

            return (
              <div key={item.label}>
                {/* ROOT ITEM */}
                {item.href ? (
                  <Link
                    href={item.href}
                    className={rootItemClass(active)}
                  >
                    <IconBlock
                      icon={<Icon size={20} strokeWidth={1.75} />}
                      active={active}
                    />
                    {!collapsed && (
                      <span className="ml-3 text-sm font-medium">
                        {item.label}
                      </span>
                    )}
                    {collapsed && (
                      <Tooltip label={item.label} />
                    )}
                  </Link>
                ) : (
                  <button
                    onClick={() =>
                      !collapsed && toggleGroup(item.label)
                    }
                    className={rootItemClass(active)}
                  >
                    <IconBlock
                      icon={<Icon size={20} strokeWidth={1.75} />}
                      active={active}
                    />
                    {!collapsed && (
                      <>
                        <span className="ml-3 text-sm font-medium flex-1 text-left">
                          {item.label}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`transition ${open[item.label]
                              ? "rotate-180"
                              : ""
                            }`}
                        />
                      </>
                    )}
                    {collapsed && (
                      <Tooltip label={item.label} />
                    )}
                  </button>
                )}

                {/* CHILDREN */}
                {!collapsed && hasChildren && open[item.label] && (
                  <div className="ml-11 mt-1 space-y-1">
                    {item.children.map(child => {
                      const ChildIcon = child.icon;
                      const childActive =
                        pathname.startsWith(child.href);

                      return (
                        <Link
                          key={child.label}
                          href={child.href}
                          className={`
                            flex items-center gap-3
                            px-3 py-2 rounded-lg text-sm
                            transition
                            ${childActive
                              ? "bg-blue-100 text-blue-700"
                              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            }
                          `}
                        >
                          <ChildIcon size={16} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* ───────── BOTTOM ───────── */}
      <div className="px-3 pb-4 space-y-3">
        

        {/* TOGGLE */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-auto flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition"
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>
    </aside>
  );
}

/* =========================
   UI HELPERS
========================= */

function rootItemClass(active) {
  return `
    group relative w-full
    flex items-center
    h-11 px-3 rounded-xl
    transition-all duration-200
    ${active
      ? "bg-blue-100 text-blue-700"
      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
    }
  `;
}

function IconBlock({ icon, active }) {
  return (
    <div
      className={`
        flex items-center justify-center
        w-8 h-8 rounded-lg
        transition
        ${active
          ? "text-blue-600"
          : "text-gray-400 group-hover:text-gray-600"
        }
      `}
    >
      {icon}
    </div>
  );
}

function Tooltip({ label }) {
  return (
    <span
      className="
        pointer-events-none absolute left-full ml-3
        whitespace-nowrap rounded-md
        bg-gray-900 px-2 py-1
        text-xs text-white opacity-0
        group-hover:opacity-100 transition
      "
    >
      {label}
    </span>
  );
}
