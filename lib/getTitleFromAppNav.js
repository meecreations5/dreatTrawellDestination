import { APP_NAV } from "@/config/appNavigation";

export function getTitleFromAppNav(pathname) {
  if (!pathname) return "Dashboard";

  for (const item of APP_NAV) {
    /* =========================
       1️⃣ CHILD ROUTES (MOST SPECIFIC)
    ========================== */
    if (item.children?.length) {
      const child = item.children.find(c =>
        pathname === c.href ||
        pathname.startsWith(c.href + "/")
      );

      if (child) {
        return `${item.label} – ${child.label}`;
      }
    }

    /* =========================
       2️⃣ DECLARED ROUTES
    ========================== */
    if (item.routes?.includes(pathname)) {
      return item.label;
    }

    /* =========================
       3️⃣ BASE ROUTE (LAST)
    ========================== */
    if (pathname === item.base) {
      return item.label;
    }
  }

  /* =========================
     FALLBACK
  ========================== */
  return "Dashboard";
}
