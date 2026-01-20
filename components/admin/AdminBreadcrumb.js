"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminSidebar } from "@/config/adminSidebar";

function findPath(items, pathname, parents = []) {
  for (const item of items) {
    if (item.href === pathname) {
      return [...parents, item];
    }

    if (item.children) {
      const found = findPath(
        item.children,
        pathname,
        [...parents, item]
      );
      if (found) return found;
    }
  }
  return null;
}

export default function AdminBreadcrumb() {
  const pathname = usePathname();

  const trail = findPath(adminSidebar, pathname) || [];

  return (
    <nav className="mb-4 text-sm text-gray-600">
      <ol className="flex items-center flex-wrap gap-1">
        {/* Admin root */}
        <li>
          <Link
            href="/admin/dashboard"
            className="hover:text-gray-900 font-medium"
          >
            Admin
          </Link>
        </li>

        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li key={item.label} className="flex items-center gap-1">
              <span className="mx-1 text-gray-400">/</span>
              {isLast ? (
                <span className="text-gray-900 font-semibold">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href || "#"}
                  className="hover:text-gray-900"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
