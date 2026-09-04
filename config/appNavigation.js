import {
  LayoutDashboard,
  MessageSquare,
  Target,
  User,
  CalendarClock,
  ListTodo,
  PlaneTakeoff,
  Map
} from "lucide-react";

export const APP_NAV = [
  /* =========================
     DASHBOARD
  ========================== */
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    base: "/dashboard",
    routes: ["/dashboard"],
    showInNav: true,
    permission: "dashboard.view"
  },


  {
    id: "action-center",
    label: "Action Center",
    icon: ListTodo,
    base: "/action-center",
    routes: ["/action-center"],
    showInNav: true,
    permission: "dashboard.view"
  },


  /* =========================
     TRAVEL AGENTS
  ========================== */
  {
    id: "travel-agents",
    label: "Travel Agents",
    icon: PlaneTakeoff,
    base: "/travel-agents",
    routes: ["/travel-agents", "/travel-agents/[agentId]"],
    showInNav: true,
    permission: "travel_agents.view"
  },


  /* =========================
     ENGAGEMENTS
  ========================== */
  {
    id: "engagements",
    label: "Engagements",
    icon: MessageSquare,
    base: "/engagements/my",
    routes: [
      "/engagements",
      "/engagements/",
      "/travel-agents",
      "/engagements/travel-agent/[agentId]"
    ],
    showInNav: true,
    permission: "engagements.view",
    fab: {
      label: "Log Engagement",
      action: "engagement"
    },
    children: [
      {
        label: "My Engagements",
        href: "/engagements/my"
      }
    ]
  },

  /* =========================
     MEETINGS
  ========================== */
  {
    id: "meetings",
    label: "Meetings",
    icon: CalendarClock,
    base: "/meetings",
    routes: ["/meetings"],
    showInNav: true,
    permission: "meetings.view"
  },

  /* =========================
     LEADS
  ========================== */
  {
    id: "leads",
    label: "Leads",
    icon: Target,
    base: "/leads",
    routes: [
      "/leads",
      "/leads/[leadId]",
      "/leads/pipeline",
      "/leads/reports"
    ],
    showInNav: true,
    permission: "leads.view",
    fab: {
      label: "Add Lead",
      action: "lead"
    },
    children: [
      {
        label: "All Leads",
        href: "/leads/my"
      },
      {
        label: "Create",
        href: "/leads/create"
      }
    ]
  },

  /* =========================
     DESTINATIONS
  ========================== */
  {
    id: "destinations",
    label: "Destinations",
    icon: Map,
    base: "/destination-library",
    routes: ["/destination-library"],
    showInNav: true,
    permission: "destinations.view"
  },


  /* =========================
     PROFILE
  ========================== */
  {
    id: "profile",
    label: "Profile",
    icon: User,
    base: "/profile",
    routes: [
      "/profile",
      "/profile/settings"
    ],
    showInNav: true,
    children: [
      {
        label: "My Profile",
        href: "/profile"
      }
    ]
  }
];
