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
    permission: "dashboard.view"
  },

  {
    label: "Action Center",
    icon: ListTodo,
    href: "/admin/action-center",
    permission: "dashboard.view"
  },

  {
    label: "Travel Agents",
    icon: PlaneTakeoff,
    permission: "travel_agents.view",
    children: [
      {
        label: "Dashboard",
        icon: BarChart3,
        href: "/admin/travel-agents/dashboard",
        permission: "travel_agents.view"
      },
      {
        label: "All Agents",
        icon: Users,
        href: "/admin/travel-agents",
        permission: "travel_agents.view"
      },
      {
        label: "Assigned Agents",
        icon: UserCheck,
        href: "/admin/travel-agents/assigned",
        permission: "travel_agents.view"
      },
      {
        label: "My Assigned",
        icon: ListChecks,
        href: "/admin/travel-agents/my-assigned",
        permission: "travel_agents.view"
      },
      {
        label: "Add Agent",
        icon: UserPlus,
        href: "/admin/travel-agents/new",
        permission: "travel_agents.create"
      },
      {
        label: "Bulk Upload",
        icon: UploadCloud,
        href: "/admin/travel-agents/bulk-upload",
        permission: "travel_agents.create"
      }
    ]
  },

  {
    label: "Engagements",
    icon: Handshake,
    href: "/admin/engagements",
    permission: "engagements.view"
  },

  {
    label: "Meetings",
    icon: CalendarClock,
    href: "/admin/meetings",
    permission: "meetings.view"
  },

  {
    label: "Leads",
    icon: Target,
    permission: "leads.view",
    children: [
      {
        label: "All Leads",
        icon: Target,
        href: "/admin/leads",
        permission: "leads.view"
      },
      {
        label: "Manual Lead",
        icon: PlusCircle,
        href: "/admin/leads/new",
        permission: "leads.create"
      },
      {
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/leads/dashboard",
        permission: "leads.view"
      }
    ]
  },

  {
    label: "Vendors",
    icon: Building2,
    permission: "vendors.view",
    children: [
      {
        label: "All Vendors",
        icon: Building2,
        href: "/admin/vendors",
        permission: "vendors.view"
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
    permission: "destinations.view",
    children: [
      {
        label: "All Destinations",
        icon: MapPin,
        href: "/admin/destinations",
        permission: "destinations.view"
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
    permission: "communications.view",
    children: [
      {
        label: "Templates",
        icon: FileText,
        href: "/admin/communication-templates",
        permission: "communications.view"
      },
      {
        label: "Categories",
        icon: Folder,
        href: "/admin/template-categories",
        permission: "communications.view"
      }
    ]
  },

  {
    label: "Documents",
    icon: Folder,
    permission: "documents.view",
    children: [
      {
        label: "Repository",
        icon: FileText,
        href: "/admin/documents",
        permission: "documents.view"
      },
      {
        label: "Versions",
        icon: GitBranch,
        href: "/admin/documents/versions",
        permission: "documents.view"
      }
    ]
  },


  {
    label: "Team Management",
    icon: UserCog,
    permission: "users.view",
    children: [
      {
        label: "Users",
        icon: Users,
        href: "/admin/users",
        permission: "users.view"
      },
      {
        label: "Add User",
        icon: UserPlus,
        href: "/admin/users/new",
        permission: "users.create"
      },
      {
        label: "Role Management",
        icon: ShieldCheck,
        href: "/admin/roles",
        permission: "users.manage_role"
      }
    ]
  },

  {
    label: "Settings",
    icon: Settings,
    permission: "settings.view",
    children: [
      {
        label: "Branding",
        icon: Building2,
        href: "/admin/settings/branding",
        permission: "settings.view"
      }
    ]
  },

  {
    label: "Quotation",
    icon: FileText,
    permission: "quotations.view",
    children: [
      {
        label: "Quotation Templates",
        icon: FileText,
        href: "/admin/settings/quotation-templates",
        permission: "quotations.view"
      }
    ]
  }
];