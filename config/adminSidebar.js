// config/adminSidebar.js

import {
  LayoutDashboard,
  Users,
  UserPlus,
  Handshake,
  Target,
  PlusCircle,
  BarChart3,
  Map,
  MapPin,
  MessageSquare,
  FileText,
  Folder,
  GitBranch,
  UserCog,
  CalendarDays,
  PlaneTakeoff,
  Settings,
  History,
  ClipboardCheck,
  Calendar
} from "lucide-react";

export const adminSidebar = [
  /* ================= DASHBOARD ================= */
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard"
  },

  /* ================= TRAVEL AGENTS ================= */
  {
    label: "Travel Agents",
    icon: PlaneTakeoff,
    children: [
      {
        label: "Dashboard",
        icon: BarChart3,
        href: "/admin/travel-agents/dashboard"
      },
      {
        label: "All Agents",
        icon: Users,
        href: "/admin/travel-agents"
      },
      {
        label: "Add Agent",
        icon: UserPlus,
        href: "/admin/travel-agents/new"
      },
      {
        label: "Engagements",
        icon: Handshake,
        href: "/admin/travel-agents/engagements"
      }
    ]
  },

  /* ================= LEADS ================= */
  {
    label: "Leads",
    icon: Target,
    children: [
      {
        label: "All Leads",
        icon: Target,
        href: "/admin/leads"
      },
      {
        label: "Manual Lead",
        icon: PlusCircle,
        href: "/admin/leads/new"
      },
      {
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/leads/dashboard"
      }
    ]
  },

  /* ================= DESTINATIONS ================= */
  {
    label: "Destinations",
    icon: Map,
    children: [
      {
        label: "All Destinations",
        icon: MapPin,
        href: "/admin/destinations"
      },
      {
        label: "Add Destination",
        icon: PlusCircle,
        href: "/admin/destinations/new"
      }
    ]
  },

  /* ================= COMMUNICATION ================= */
  {
    label: "Communication",
    icon: MessageSquare,
    children: [
      {
        label: "Templates",
        icon: FileText,
        href: "/admin/communication-templates"
      },
      {
        label: "Categories",
        icon: Folder,
        href: "/admin/template-categories"
      }
    ]
  },

  /* ================= DOCUMENTS ================= */
  {
    label: "Documents",
    icon: Folder,
    children: [
      {
        label: "Repository",
        icon: FileText,
        href: "/admin/documents"
      },
      {
        label: "Versions",
        icon: GitBranch,
        href: "/admin/documents/versions"
      }
    ]
  },

  /* ================= ATTENDANCE ================= */
  {
    label: "Attendance",
    icon: CalendarDays,
    children: [
      {
        label: "Leave",
        icon: ClipboardCheck,
        href: "/admin/attendance/leave"
      },
      {
        label: "History",
        icon: History,
        href: "/admin/attendance/history"
      },
      {
        label: "Monthly",
        icon: Calendar,
        href: "/admin/attendance/monthly"
      },
      {
        label: "Regularisation",
        icon: ClipboardCheck,
        href: "/admin/attendance/regularisation"
      }
    ]
  },

  /* ================= TEAM MANAGEMENT ================= */
  {
    label: "Team Management",
    icon: UserCog,
    children: [
      {
        label: "Users",
        icon: Users,
        href: "/admin/users"
      },
      {
        label: "Add User",
        icon: UserPlus,
        href: "/admin/users/new"
      }
    ]
  },

  /* ================= SETTINGS ================= */
  {
    label: "Settings",
    icon: Settings,
    href: "/admin/settings"
  }
];
