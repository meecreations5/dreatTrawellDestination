"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BRAND = "Dream Trawell";

const EXACT_TITLES = {
  "/": "CRM",
  "/login": "Team Login",
  "/admin/login": "Admin Login",

  "/dashboard": "Team Dashboard",
  "/action-center": "Action Center",
  "/engagements": "Engagements",
  "/engagements/my": "My Engagements",
  "/leads": "Leads",
  "/leads/my": "My Leads",
  "/leads/create": "Create Lead",
  "/meetings": "Meetings",
  "/travel-agents": "Travel Agents",
  "/profile": "My Profile",
  "/profile/setting": "Profile Settings",
  "/clients": "Clients",
  "/destinations": "Destinations",
  "/attendance": "Attendance",
  "/attendance/history": "Attendance History",
  "/attendance/monthly": "Monthly Attendance",
  "/attendance/regularisation": "Attendance Regularisation",
  "/attendance/leave": "Attendance & Leave",
  "/leave/apply": "Apply Leave",
  "/leave/my": "My Leave",

  "/admin": "Admin Console",
  "/admin/dashboard": "Management Dashboard",
  "/admin/action-center": "Admin Action Center",
  "/admin/engagements": "Admin Engagements",
  "/admin/leads": "Lead Management",
  "/admin/leads/dashboard": "Lead Dashboard",
  "/admin/leads/deleted": "Deleted Leads",
  "/admin/meetings": "Meeting Management",
  "/admin/travel-agents": "Travel Agent Management",
  "/admin/travel-agents/dashboard": "Travel Agent Dashboard",
  "/admin/travel-agents/assigned": "Assigned Travel Agents",
  "/admin/travel-agents/my-assigned": "My Assigned Travel Agents",
  "/admin/travel-agents/new": "Add Travel Agent",
  "/admin/travel-agents/bulk-upload": "Travel Agent Bulk Upload",
  "/admin/users": "Team Management",
  "/admin/users/new": "Add Team Member",
  "/admin/vendors": "Vendor Management",
  "/admin/vendors/new": "Add Vendor",
  "/admin/destinations": "Destination Management",
  "/admin/documents": "Document Library",
  "/admin/communication-templates": "Communication Templates",
  "/admin/template-categories": "Template Categories",
  "/admin/attendance": "Admin Attendance",
  "/admin/attendance/history": "Attendance History",
  "/admin/attendance/monthly": "Monthly Attendance",
  "/admin/attendance/regularisation": "Attendance Regularisation",
  "/admin/attendance/holiday": "Holiday Calendar",
  "/admin/attendance/leave": "Leave Management",
  "/admin/settings/branding": "Branding Settings",
  "/admin/settings/quotation-templates": "Quotation Templates"
};

const ROUTE_PATTERNS = [
  [/^\/admin\/leads\/[^/]+$/, "Lead Details"],
  [/^\/leads\/[^/]+$/, "Lead Details"],
  [/^\/admin\/travel-agents\/[^/]+$/, "Travel Agent Profile"],
  [/^\/travel-agents\/[^/]+$/, "Travel Agent Profile"],
  [/^\/engagements\/travel-agent\/[^/]+$/, "Travel Agent Engagement"],
  [/^\/engagements\/[^/]+$/, "Engagement Details"],
  [/^\/admin\/users\/[^/]+$/, "Team Member Profile"],
  [/^\/admin\/vendors\/[^/]+$/, "Vendor Details"],
  [/^\/admin\/communication-templates\/[^/]+$/, "Communication Template"],
  [/^\/admin\/destinations\/[^/]+\/activities\/new$/, "Add Destination Activity"],
  [/^\/admin\/destinations\/[^/]+\/activities\/[^/]+$/, "Destination Activity"],
  [/^\/admin\/destinations\/[^/]+\/activities$/, "Destination Activities"],
  [/^\/admin\/destinations\/[^/]+$/, "Destination Details"],
  [/^\/destinations\/[^/]+$/, "Destination Details"]
];

function titleCase(value = "") {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim();
}

function resolvePageTitle(pathname = "/") {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];

  const matchingPattern = ROUTE_PATTERNS.find(([pattern]) => pattern.test(pathname));
  if (matchingPattern) return matchingPattern[1];

  const segments = pathname.split("/").filter(Boolean);
  const lastUsefulSegment = [...segments]
    .reverse()
    .find(segment => !/^[A-Za-z0-9_-]{18,}$/.test(segment));

  return titleCase(lastUsefulSegment || "CRM");
}

export default function PageTitleManager() {
  const pathname = usePathname();

  useEffect(() => {
    const pageTitle = resolvePageTitle(pathname || "/");
    document.title = `${pageTitle} | ${BRAND}`;
  }, [pathname]);

  return null;
}
