import {
  CalendarDays,
  MessageSquare,
  Target,
  User
} from "lucide-react";

export const APP_NAV = [
  {
    id: "attendance",
    label: "Attendance",
    icon: CalendarDays,
    base: "/attendance",
    routes: [
      "/attendance",
      "/attendance/history",
      "/attendance/monthly",
      "/attendance/regularisation"
    ],
    showInNav: true,
    children: [
      {
        label: "Today",
        href: "/attendance"
      },
      {
        label: "History",
        href: "/attendance/history"
      },
      {
        label: "Leave",
        href: "/attendance/leave"
      },
      {
        label: "Regularisation",
        href: "/attendance/regularisation"
      }
    ]
  },

  {
    id: "engagements",
    label: "Engagement",
    icon: MessageSquare,
    base: "/engagements",
    routes: [
      "/engagements",
      "/engagements/my",
      "/travel-agents",
      "/engagements/travel-agent/[agentId]"
    ],
    showInNav: true,
    fab: {
      label: "Log Engagement",
      action: "engagement"
    },
    children: [
      {
        label: "My Engagements",
        href: "/engagements/my"
      },
      {
        label: "By Travel Agent",
        href: "/travel-agents"
      }
    ]
  },

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
    fab: {
      label: "Add Lead",
      action: "lead"
    },
    children: [
      {
        label: "All Leads",
        href: "/leads"
      },
      {
        label: "Create",
        href: "/leads/create"
      }
      
    ]
  },

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
      },
      {
        label: "Settings",
        href: "/profile/settings"
      }
    ]
  }
];
