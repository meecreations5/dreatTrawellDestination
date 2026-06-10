"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { adminSidebar } from "@/config/adminSidebar";
import { canAccess } from "@/lib/rolePermissions";

export default function AdminSidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState({});

  const toggleGroup = (label) => {
    setOpen((prev) => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const visibleSidebar = useMemo(() => {
    if (loading || !user) return [];

    return adminSidebar
      .map((item) => {
        const hasChildren =
          Array.isArray(item.children) && item.children.length > 0;

        if (hasChildren) {
          const visibleChildren = item.children.filter((child) => {
            if (!child.permission) return true;
            return canAccess(user, child.permission);
          });

          if (visibleChildren.length === 0) return null;

          return {
            ...item,
            children: visibleChildren
          };
        }

        if (!item.permission) return item;

        return canAccess(user, item.permission) ? item : null;
      })
      .filter(Boolean);
  }, [user, loading]);

  return (
    <aside
      className={`
        fixed left-4 top-4 bottom-4
        flex flex-col justify-between
        rounded-2xl bg-white
        shadow-[0_10px_30px_rgba(0,0,0,0.06)]
        transition-all duration-300
        ${collapsed ? "w-[72px]" : "w-[280px]"}
      `}
    >
      <div className="px-3 pt-4">
        <div className="flex justify-center pb-4">
          <Image
            src="/logo.png"
            alt="Logo"
            priority
            width={80}
            height={80}
          />
        </div>

        <nav className="space-y-2">
          {visibleSidebar.map((item) => {
            const Icon = item.icon;
            const hasChildren =
              Array.isArray(item.children) && item.children.length > 0;

            const isActive =
              item.href && pathname.startsWith(item.href);

            const isChildActive =
              hasChildren &&
              item.children.some((child) =>
                pathname.startsWith(child.href)
              );

            const active = isActive || isChildActive;

            return (
              <div key={item.label}>
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

                    {collapsed && <Tooltip label={item.label} />}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!collapsed) toggleGroup(item.label);
                    }}
                    className={rootItemClass(active)}
                  >
                    <IconBlock
                      icon={<Icon size={20} strokeWidth={1.75} />}
                      active={active}
                    />

                    {!collapsed && (
                      <>
                        <span className="ml-3 flex-1 text-left text-sm font-medium">
                          {item.label}
                        </span>

                        <ChevronDown
                          size={16}
                          className={`transition ${
                            open[item.label] || active ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}

                    {collapsed && <Tooltip label={item.label} />}
                  </button>
                )}

                {!collapsed &&
                  hasChildren &&
                  (open[item.label] || active) && (
                    <div className="ml-11 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = pathname.startsWith(child.href);

                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            className={`
                              flex items-center gap-3
                              rounded-lg px-3 py-2 text-sm
                              transition
                              ${
                                childActive
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

          {!loading && visibleSidebar.length === 0 && !collapsed && (
            <div className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
              No menu access assigned.
            </div>
          )}
        </nav>
      </div>

      <div className="space-y-3 px-3 pb-4">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mx-auto flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-200"
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

function rootItemClass(active) {
  return `
    group relative flex h-11 w-full items-center
    rounded-xl px-3
    transition-all duration-200
    ${
      active
        ? "bg-blue-100 text-blue-700"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
    }
  `;
}

function IconBlock({ icon, active }) {
  return (
    <div
      className={`
        flex h-8 w-8 items-center justify-center
        rounded-lg transition
        ${
          active
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
        whitespace-nowrap rounded-md bg-gray-900
        px-2 py-1 text-xs text-white opacity-0
        transition group-hover:opacity-100
      "
    >
      {label}
    </span>
  );
}