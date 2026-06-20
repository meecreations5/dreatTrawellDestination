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
  Calendar,
  UploadCloud,
  ShieldCheck,
  Building2,
  ListChecks
} from "lucide-react";

export const adminSidebar = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
    permission: "dashboard"
  },

  {
    label: "Travel Agents",
    icon: PlaneTakeoff,
    permission: "travelAgentManagement",
    children: [
      {
        label: "Dashboard",
        icon: BarChart3,
        href: "/admin/travel-agents/dashboard",
        permission: "travelAgentManagement"
      },
      {
        label: "All Agents",
        icon: Users,
        href: "/admin/travel-agents",
        permission: "travelAgentManagement"
      },
      {
        label: "Add Agent",
        icon: UserPlus,
        href: "/admin/travel-agents/new",
        permission: "travelAgentManagement"
      },
      {
        label: "Bulk Upload",
        icon: UploadCloud,
        href: "/admin/travel-agents/bulk-upload",
        permission: "travelAgentManagement"
      },
      {
        label: "Engagements",
        icon: Handshake,
        href: "/admin/travel-agents/engagements",
        permission: "travelAgentManagement"
      }
    ]
  },

  {
    label: "Leads",
    icon: Target,
    permission: "leadManagement",
    children: [
      {
        label: "All Leads",
        icon: Target,
        href: "/admin/leads",
        permission: "leadManagement"
      },
      {
        label: "Manual Lead",
        icon: PlusCircle,
        href: "/admin/leads/new",
        permission: "leadManagement"
      },
      {
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/leads/dashboard",
        permission: "leadManagement"
      }
    ]
  },

  {
    label: "Vendors",
    icon: Building2,
    permission: "leadManagement",
    children: [
      {
        label: "All Vendors",
        icon: Building2,
        href: "/admin/vendors",
        permission: "leadManagement"
      },
      {
        label: "Add Vendor",
        icon: PlusCircle,
        href: "/admin/vendors/new",
        permission: "leadManagement"
      }
    ]
  },

  {
    label: "Destinations",
    icon: Map,
    permission: "destinationManagement",
    children: [
      {
        label: "All Destinations",
        icon: MapPin,
        href: "/admin/destinations",
        permission: "destinationManagement"
      },
      {
        label: "Add Destination",
        icon: PlusCircle,
        href: "/admin/destinations/new",
        permission: "destinationManagement"
      }
    ]
  },

  {
    label: "Communication",
    icon: MessageSquare,
    permission: "communicationManagement",
    children: [
      {
        label: "Templates",
        icon: FileText,
        href: "/admin/communication-templates",
        permission: "communicationManagement"
      },
      {
        label: "Categories",
        icon: Folder,
        href: "/admin/template-categories",
        permission: "communicationManagement"
      }
    ]
  },

  {
    label: "Documents",
    icon: Folder,
    permission: "documentManagement",
    children: [
      {
        label: "Repository",
        icon: FileText,
        href: "/admin/documents",
        permission: "documentManagement"
      },
      {
        label: "Versions",
        icon: GitBranch,
        href: "/admin/documents/versions",
        permission: "documentManagement"
      }
    ]
  },

  {
    label: "Attendance",
    icon: CalendarDays,
    permission: "attendanceManagement",
    children: [
      {
        label: "Leave",
        icon: ClipboardCheck,
        href: "/admin/attendance/leave",
        permission: "attendanceManagement"
      },
      {
        label: "History",
        icon: History,
        href: "/admin/attendance/history",
        permission: "attendanceManagement"
      },
      {
        label: "Monthly",
        icon: Calendar,
        href: "/admin/attendance/monthly",
        permission: "attendanceManagement"
      },
      {
        label: "Regularisation",
        icon: ClipboardCheck,
        href: "/admin/attendance/regularisation",
        permission: "attendanceManagement"
      }
    ]
  },

  {
    label: "Team Management",
    icon: UserCog,
    permission: "userManagement",
    children: [
      {
        label: "Users",
        icon: Users,
        href: "/admin/users",
        permission: "userManagement"
      },
      {
        label: "Add User",
        icon: UserPlus,
        href: "/admin/users/new",
        permission: "userManagement"
      },
      {
        label: "Role Management",
        icon: ShieldCheck,
        href: "/admin/roles",
        permission: "roleManagement"
      }
    ]
  },

  {
    label: "Settings",
    icon: Settings,
    href: "/admin/settings/branding",
    permission: "settingsManagement"
  }
];