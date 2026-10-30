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
  PlaneTakeoff,
  Settings,
  UploadCloud,
  ShieldCheck,
  Building2,
  ListChecks,
  UserCheck,
  CalendarClock,
  ListTodo
} from "lucide-react";

export const adminSidebar = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
    permission: "admin.dashboard"
  },

  {
    label: "Action Center",
    icon: ListTodo,
    href: "/admin/action-center",
    permission: "admin.dashboard"
  },

  {
    label: "Travel Agents",
    icon: PlaneTakeoff,
    permission: "admin.travel_agents",
    children: [
      {
        label: "Dashboard",
        icon: BarChart3,
        href: "/admin/travel-agents/dashboard",
        permission: "admin.travel_agents"
      },
      {
        label: "All Agents",
        icon: Users,
        href: "/admin/travel-agents",
        permission: "admin.travel_agents"
      },
      {
        label: "Activity Report",
        icon: BarChart3,
        href: "/admin/travel-agents/activity-report",
        permission: "admin.travel_agents"
      },
      {
        label: "Assigned Agents",
        icon: UserCheck,
        href: "/admin/travel-agents/assigned",
        permission: "admin.travel_agents"
      },
      {
        label: "My Assigned",
        icon: ListChecks,
        href: "/admin/travel-agents/my-assigned",
        permission: "admin.travel_agents"
      },
      {
        label: "Add Agent",
        icon: UserPlus,
        href: "/admin/travel-agents/new",
        permission: "admin.travel_agents"
      },
      {
        label: "Bulk Upload",
        icon: UploadCloud,
        href: "/admin/travel-agents/bulk-upload",
        permission: "admin.travel_agents"
      }
    ]
  },

  {
    label: "Engagements",
    icon: Handshake,
    href: "/admin/engagements",
    permission: "admin.engagements"
  },

  {
    label: "Meetings",
    icon: CalendarClock,
    href: "/admin/meetings",
    permission: "admin.meetings"
  },

  {
    label: "Leads",
    icon: Target,
    permission: "admin.leads",
    children: [
      {
        label: "All Leads",
        icon: Target,
        href: "/admin/leads",
        permission: "admin.leads"
      },
      {
        label: "Manual Lead",
        icon: PlusCircle,
        href: "/admin/leads/new",
        permission: "admin.leads"
      },
      {
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/leads/dashboard",
        permission: "admin.leads"
      }
    ]
  },

  {
    label: "Vendors",
    icon: Building2,
    permission: "admin.vendors",
    children: [
      {
        label: "All Vendors",
        icon: Building2,
        href: "/admin/vendors",
        permission: "admin.vendors"
      },
      {
        label: "Add Vendor",
        icon: PlusCircle,
        href: "/admin/vendors/new",
        permission: "vendors.create"
      }
    ]
  },

  {
    label: "Destinations",
    icon: Map,
    permission: "admin.destinations",
    children: [
      {
        label: "All Destinations",
        icon: MapPin,
        href: "/admin/destinations",
        permission: "admin.destinations"
      },
      {
        label: "Add Destination",
        icon: PlusCircle,
        href: "/admin/destinations/new",
        permission: "destinations.create"
      }
    ]
  },

  {
    label: "Communication",
    icon: MessageSquare,
    permission: "admin.communications",
    children: [
      {
        label: "Templates",
        icon: FileText,
        href: "/admin/communication-templates",
        permission: "admin.communications"
      },
      {
        label: "Categories",
        icon: Folder,
        href: "/admin/template-categories",
        permission: "admin.communication_categories"
      }
    ]
  },

  {
    label: "Documents",
    icon: Folder,
    permission: "admin.documents",
    children: [
      {
        label: "Repository",
        icon: FileText,
        href: "/admin/documents",
        permission: "admin.documents"
      },
      {
        label: "Versions",
        icon: GitBranch,
        href: "/admin/documents/versions",
        permission: "admin.documents"
      }
    ]
  },


  {
    label: "Team Management",
    icon: UserCog,
    permission: "admin.users",
    children: [
      {
        label: "Users",
        icon: Users,
        href: "/admin/users",
        permission: "admin.users"
      },
      {
        label: "Add User",
        icon: UserPlus,
        href: "/admin/users/new",
        permission: "admin.users"
      },
      {
        label: "Role Management",
        icon: ShieldCheck,
        href: "/admin/roles",
        permission: "admin.roles"
      }
    ]
  },

  {
    label: "Settings",
    icon: Settings,
    permission: "admin.settings",
    children: [
      {
        label: "Branding",
        icon: Building2,
        href: "/admin/settings/branding",
        permission: "admin.settings"
      },
      {
        label: "Engagement & Productivity",
        icon: CalendarClock,
        href: "/admin/settings/engagement-productivity",
        permission: "admin.settings"
      }
    ]
  },

  {
    label: "Quotation",
    icon: FileText,
    permission: "admin.quotations",
    children: [
      {
        label: "Quotation Templates",
        icon: FileText,
        href: "/admin/settings/quotation-templates",
        permission: "admin.quotations"
      }
    ]
  }
];