"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs
} from "firebase/firestore";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Filter,
  IndianRupee,
  Loader2,
  MapPin,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  Users
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  resolveDirectoryIdentity,
  teamMatchesScope
} from "@/lib/teamDirectory";
import {
  TRAVEL_AGENT_STATUS_OPTIONS,
  getTravelAgentStatusMeta,
  normalizeTravelAgentStatus
} from "@/lib/travelAgentStatus";
import { useAuth } from "@/hooks/useAuth";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { matchesAdminDateScope } from "@/lib/adminScope";
import AdminGuard from "@/components/AdminGuard";

import AssignTravelAgentModal from "@/components/travel-agents/AssignTravelAgentModal";
import BulkAssignTravelAgentModal from "@/components/travel-agents/BulkAssignTravelAgentModal";
import AgentSideDrawer from "@/components/travel-agents/AgentSideDrawer";

/* =========================
   COLLECTIONS
========================= */

const PAYMENT_COLLECTIONS = [
  "leadCustomerPayments",
  "leadVendorPayments",
  "leadPayments",
  "payments",
  "customerPayments",
  "vendorPayments"
];

/* =========================
   ROLE HELPERS
========================= */

const MANAGEMENT_ROLES = [
  "super_admin",
  "admin",
  "management",
  "manager",
  "team_lead",
  "sales_head",
  "sales_manager"
];

const normalizeRole = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isManagementUser = user => {
  if (!user) return false;

  const possibleRoles = [
    user.role,
    user.userRole,
    user.type,
    user.claims?.role,
    user.customClaims?.role,
    user.profile?.role,
    user.dbUser?.role
  ];

  return (
    user.isSuperAdmin === true ||
    user.superAdmin === true ||
    user.isAdmin === true ||
    user.claims?.super_admin === true ||
    user.customClaims?.super_admin === true ||
    possibleRoles.some(role =>
      MANAGEMENT_ROLES.includes(normalizeRole(role))
    )
  );
};

const isSuperAdminUser = user => {
  if (!user) return false;

  const possibleRoles = [
    user.role,
    user.userRole,
    user.type,
    user.claims?.role,
    user.customClaims?.role,
    user.profile?.role,
    user.dbUser?.role
  ];

  return (
    user.isSuperAdmin === true ||
    user.superAdmin === true ||
    user.claims?.super_admin === true ||
    user.customClaims?.super_admin === true ||
    possibleRoles.some(role => normalizeRole(role) === "super_admin")
  );
};

/* =========================
   COMMON HELPERS
========================= */

const normalizeText = value =>
  String(value || "").trim().toLowerCase();

const formatCurrency = value =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const toDate = value => {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }

  return null;
};

const formatDateTime = value => {
  const date = toDate(value);
  if (!date) return "No transaction";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const percentage = (part, total) => {
  if (!total) return 0;
  return Math.round((part / total) * 100);
};

/* =========================
   AGENT HELPERS
========================= */

const getAgentName = agent =>
  agent.agencyName || agent.name || "Unnamed Travel Agent";

const getAgentLocation = agent => {
  return (
    agent.city ||
    agent.location ||
    agent.officeCity ||
    agent.address?.city ||
    agent.billingAddress?.city ||
    agent.state ||
    "No city"
  );
};

const getPartnerSegment = agent =>
  agent.partnerSegment || agent.agencyType || "Not set";

const getAgentStatus = agent =>
  normalizeTravelAgentStatus(agent.status, agent.active);

const getAgentCategory = agent =>
  agent.agentCategory || "B";

const getPaymentRisk = agent =>
  agent.paymentRisk || "Low";

const getKycStatus = agent =>
  agent.kycStatus || "Pending";

const getBankStatus = agent =>
  agent.bankDetails?.verificationStatus || "Pending";

const getAssignedUid = agent =>
  agent.assignedToUid || agent.accountManagerUid || "";

const getAssignedName = agent =>
  agent.assignedToName ||
  agent.assignedToEmail ||
  agent.assignedTo ||
  agent.accountManagerUid ||
  "";

const getAssignedEmail = agent =>
  agent.assignedToEmail || "";

const getAssignedTeam = agent =>
  agent.assignedTeam || agent.team || "";

const resolveIdentity = ({ uid = "", email = "", name = "" }, userLookup) =>
  resolveDirectoryIdentity({ uid, email, name }, userLookup);

const getCreatorIdentity = (item, userLookup) => {
  const uid =
    item?.createdByUid ||
    item?.creatorUid ||
    item?.createdByUserId ||
    item?.ownerUid ||
    "";
  const email =
    item?.createdByEmail ||
    item?.creatorEmail ||
    item?.ownerEmail ||
    (typeof item?.createdBy === "string" && item.createdBy.includes("@")
      ? item.createdBy
      : "");
  const name =
    item?.createdByName ||
    item?.creatorName ||
    item?.createdByUserName ||
    item?.ownerName ||
    "";

  return resolveIdentity({ uid, email, name }, userLookup);
};

const getEngagementIdentity = (item, userLookup) => {
  const uid =
    item?.createdByUid ||
    item?.createdByUserId ||
    item?.loggedByUid ||
    item?.performedByUid ||
    item?.userUid ||
    item?.employeeUid ||
    item?.ownerUid ||
    "";
  const email =
    item?.createdByEmail ||
    item?.loggedByEmail ||
    item?.performedByEmail ||
    item?.userEmail ||
    item?.employeeEmail ||
    item?.ownerEmail ||
    "";
  const name =
    item?.createdByName ||
    item?.loggedByName ||
    item?.performedByName ||
    item?.userName ||
    item?.employeeName ||
    item?.ownerName ||
    "";

  return resolveIdentity({ uid, email, name }, userLookup);
};

const getAssignmentStatus = agent => {
  if (agent.assignmentStatus) return agent.assignmentStatus;

  return getAssignedUid(agent) || getAssignedName(agent)
    ? "Assigned"
    : "Unassigned";
};

const getAssignmentPriority = agent =>
  agent.assignmentPriority || "Medium";

const isAssignedToCurrentUser = (agent, user) => {
  if (!user) return false;

  const uid = user.uid || user.id || "";
  const email = normalizeText(
    user.email || user.workEmail || user.officialEmail
  );

  return (
    (!!uid && getAssignedUid(agent) === uid) ||
    (!!email && normalizeText(getAssignedEmail(agent)) === email) ||
    (!!email && normalizeText(getAssignedName(agent)) === email)
  );
};

/* =========================
   LEAD HELPERS
========================= */

const getLeadAgentId = lead =>
  lead.agentId ||
  lead.travelAgentId ||
  lead.travelAgentRefId ||
  lead.travelAgent?.id ||
  "";

const getLeadStatus = lead =>
  normalizeText(
    lead.status ||
      lead.stage ||
      lead.leadStatus ||
      lead.dealStatus ||
      lead.pipelineStatus
  );

const isWonLead = lead =>
  [
    "won",
    "deal won",
    "converted",
    "confirmed",
    "booking confirmed"
  ].includes(getLeadStatus(lead));

const isLostLead = lead =>
  [
    "lost",
    "deal lost",
    "cancelled",
    "canceled",
    "rejected"
  ].includes(getLeadStatus(lead));

const getLeadRevenue = lead =>
  Number(
    lead.dealValue ||
      lead.totalAmount ||
      lead.quotationAmount ||
      lead.finalAmount ||
      lead.packageAmount ||
      lead.bookingValue ||
      0
  );

const getLeadCreatedAt = lead =>
  lead.createdAt ||
  lead.updatedAt ||
  lead.leadCreatedAt ||
  lead.createdOn ||
  null;

const getAgentCreatedAt = agent =>
  agent.createdAt || agent.addedAt || agent.createdOn || null;

const getEngagementDate = engagement =>
  engagement.createdAt || engagement.updatedAt || engagement.engagedAt || null;

const getEngagementAgentId = engagement =>
  engagement.agentId ||
  engagement.travelAgentId ||
  engagement.travelAgent?.id ||
  engagement.agent?.id ||
  "";

/* =========================
   TRANSACTION HELPERS
========================= */

const getTransactionAgentId = transaction =>
  transaction.agentId ||
  transaction.travelAgentId ||
  transaction.travelAgentRefId ||
  transaction.travelAgent?.id ||
  "";

const getTransactionLeadId = transaction =>
  transaction.leadId ||
  transaction.leadRefId ||
  transaction.lead?.id ||
  "";

const getTransactionDate = transaction =>
  transaction.paidAt ||
  transaction.receivedAt ||
  transaction.transactionDate ||
  transaction.paymentDate ||
  transaction.createdAt ||
  transaction.updatedAt ||
  null;

const getTransactionAmount = transaction =>
  Number(
    transaction.amount ||
      transaction.paidAmount ||
      transaction.receivedAmount ||
      transaction.paymentAmount ||
      transaction.totalAmount ||
      transaction.value ||
      0
  );

const getTransactionMode = transaction =>
  transaction.paymentMode ||
  transaction.mode ||
  transaction.method ||
  transaction.type ||
  "Payment";

const getTransactionDirection = transaction => {
  const type = normalizeText(
    transaction.paymentType ||
      transaction.transactionType ||
      transaction.direction ||
      transaction.collectionName
  );

  if (type.includes("vendor")) return "Vendor Payment";
  if (type.includes("customer")) return "Customer Payment";
  if (type.includes("received")) return "Received";
  if (type.includes("paid")) return "Paid";

  return "Transaction";
};

const groupSum = (rows, keyGetter, valueGetter) => {
  const map = {};

  rows.forEach(row => {
    const key = keyGetter(row) || "Unknown";
    const value = Number(valueGetter(row) || 0);

    map[key] = (map[key] || 0) + value;
  });

  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

/* =========================
   DASHBOARD FILTERS
========================= */

const INITIAL_AGENT_FILTERS = {
  search: "",
  agentStatus: "all",
  category: "all",
  assignmentStatus: "all",
  assignmentPriority: "all",
  paymentRisk: "all",
  viewScope: "all"
};

/* =========================
   PAGE
========================= */

export default function TravelAgentDashboardPage() {
  const { user } = useAuth();
  const { scope, teamDirectory, userLookup } = useAdminScope();

  const isManagement = isManagementUser(user);
  const isSuperAdmin = isSuperAdminUser(user);

  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedAgent, setSelectedAgent] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState(() => ({ ...INITIAL_AGENT_FILTERS }));

  useEffect(() => {
    if (!user) return;

    if (!isManagement) {
      setFilters(prev => ({
        ...prev,
        viewScope: "my"
      }));
    }
  }, [user, isManagement]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const [agentSnap, leadSnap, destinationSnap, engagementSnap, paymentSnapshots] =
        await Promise.all([
          getDocs(collection(db, "travelAgents")),
          getDocs(collection(db, "leads")),
          getDocs(collection(db, "destinations")),
          getDocs(collection(db, "engagements")),
          Promise.all(
            PAYMENT_COLLECTIONS.map(async collectionName => {
              try {
                const snap = await getDocs(collection(db, collectionName));

                return snap.docs.map(item => ({
                  id: item.id,
                  collectionName,
                  ...item.data()
                }));
              } catch (error) {
                console.warn(
                  `Unable to load ${collectionName}`,
                  error?.message
                );
                return [];
              }
            })
          )
        ]);

      setAgents(
        agentSnap.docs.map(item => ({
          id: item.id,
          ...item.data()
        }))
      );

      setLeads(
        leadSnap.docs.map(item => ({
          id: item.id,
          ...item.data()
        }))
      );

      setDestinations(
        destinationSnap.docs.map(item => ({
          id: item.id,
          ...item.data()
        }))
      );

      setEngagements(
        engagementSnap.docs.map(item => ({
          id: item.id,
          ...item.data()
        }))
      );

      setTransactions(paymentSnapshots.flat());
    } catch (error) {
      console.error(error);
      setLoadError(
        error?.message || "Unable to load travel agent dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const destinationMap = useMemo(() => {
    const map = {};

    destinations.forEach(destination => {
      map[destination.id] =
        destination.name ||
        destination.title ||
        destination.destinationName ||
        destination.id;
    });

    return map;
  }, [destinations]);

  const getAgentDestinations = useCallback(
    agent => {
      if (Array.isArray(agent.destinationIds)) {
        return agent.destinationIds.map((id, index) => ({
          id: id || `dest-${index}`,
          name: destinationMap[id] || id || "Unknown"
        }));
      }

      if (
        Array.isArray(agent.destinations) &&
        typeof agent.destinations[0] === "string"
      ) {
        return agent.destinations.map((id, index) => ({
          id: id || `dest-${index}`,
          name: destinationMap[id] || id || "Unknown"
        }));
      }

      if (
        Array.isArray(agent.destinations) &&
        typeof agent.destinations[0] === "object"
      ) {
        return agent.destinations.map((destination, index) => ({
          id: destination.id || destination.name || `dest-${index}`,
          name:
            destination.name ||
            destinationMap[destination.id] ||
            destination.id ||
            "Unknown"
        }));
      }

      return [];
    },
    [destinationMap]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter(lead =>
      matchesAdminDateScope(
        getLeadCreatedAt(lead),
        scope.dateRange,
        scope.dateFrom,
        scope.dateTo
      )
    );
  }, [leads, scope.dateRange, scope.dateFrom, scope.dateTo]);

  const leadMapByAgent = useMemo(() => {
    const map = {};

    filteredLeads.forEach(lead => {
      const agentId = getLeadAgentId(lead);

      if (!agentId) return;

      if (!map[agentId]) map[agentId] = [];
      map[agentId].push(lead);
    });

    return map;
  }, [filteredLeads]);

  const leadAgentMap = useMemo(() => {
    const map = {};

    leads.forEach(lead => {
      const agentId = getLeadAgentId(lead);
      if (!agentId) return;

      map[lead.id] = agentId;

      if (lead.leadId) map[lead.leadId] = agentId;
      if (lead.leadCode) map[lead.leadCode] = agentId;
    });

    return map;
  }, [leads]);

  const transactionMapByAgent = useMemo(() => {
    const map = {};

    transactions.forEach(transaction => {
      const directAgentId = getTransactionAgentId(transaction);
      const leadId = getTransactionLeadId(transaction);

      const agentId =
        directAgentId ||
        leadAgentMap[leadId] ||
        "";

      if (!agentId) return;

      if (!map[agentId]) map[agentId] = [];

      map[agentId].push(transaction);
    });

    Object.keys(map).forEach(agentId => {
      map[agentId].sort((a, b) => {
        const ad = toDate(getTransactionDate(a))?.getTime() || 0;
        const bd = toDate(getTransactionDate(b))?.getTime() || 0;
        return bd - ad;
      });
    });

    return map;
  }, [transactions, leadAgentMap]);

  const enrichedAgents = useMemo(() => {
    return agents.map(agent => {
      const agentLeads = leadMapByAgent[agent.id] || [];
      const wonLeads = agentLeads.filter(isWonLead);
      const lostLeads = agentLeads.filter(isLostLead);

      const agentTransactions = transactionMapByAgent[agent.id] || [];
      const lastTransaction = agentTransactions[0] || null;

      const revenue = wonLeads.reduce(
        (sum, lead) => sum + getLeadRevenue(lead),
        0
      );

      const transactionValue = agentTransactions.reduce(
        (sum, transaction) => sum + getTransactionAmount(transaction),
        0
      );

      const assignedIdentity = resolveIdentity({
        uid: getAssignedUid(agent),
        email: getAssignedEmail(agent),
        name: getAssignedName(agent)
      }, userLookup);
      const creatorIdentity = getCreatorIdentity(agent, userLookup);

      return {
        ...agent,
        agentName: getAgentName(agent),
        agentStatus: getAgentStatus(agent),
        category: getAgentCategory(agent),
        paymentRisk: getPaymentRisk(agent),
        kycStatus: getKycStatus(agent),
        bankStatus: getBankStatus(agent),
        assignedUid: assignedIdentity.uid || getAssignedUid(agent),
        assignedKey: assignedIdentity.isUnmapped ? "" : assignedIdentity.key,
        assignedName: assignedIdentity.isUnmapped ? getAssignedName(agent) : assignedIdentity.name,
        assignedTeam: assignedIdentity.isUnmapped ? "" : assignedIdentity.team,
        creatorKey: creatorIdentity.isUnmapped ? "" : creatorIdentity.key,
        creatorName: creatorIdentity.isUnmapped ? "Legacy / Unmapped" : creatorIdentity.name,
        creatorTeam: creatorIdentity.isUnmapped ? "" : creatorIdentity.team,
        creatorIsUnmapped: creatorIdentity.isUnmapped === true,
        assignmentStatus: getAssignmentStatus(agent),
        assignmentPriority: getAssignmentPriority(agent),
        totalLeads: agentLeads.length,
        wonLeads: wonLeads.length,
        lostLeads: lostLeads.length,
        revenue,
        conversion: percentage(wonLeads.length, agentLeads.length),
        transactionCount: agentTransactions.length,
        transactionValue,
        lastTransaction,
        lastTransactionAt: lastTransaction
          ? getTransactionDate(lastTransaction)
          : null,
        lastTransactionAmount: lastTransaction
          ? getTransactionAmount(lastTransaction)
          : 0,
        lastTransactionMode: lastTransaction
          ? getTransactionMode(lastTransaction)
          : "",
        lastTransactionDirection: lastTransaction
          ? getTransactionDirection(lastTransaction)
          : "No Transaction"
      };
    });
  }, [agents, leadMapByAgent, transactionMapByAgent, userLookup]);

  const filteredAgents = useMemo(() => {
    const search = normalizeText(filters.search);

    return enrichedAgents.filter(agent => {
      const matchesSearch =
        !search ||
        normalizeText(agent.agentName).includes(search) ||
        normalizeText(agent.agentCode).includes(search) ||
        normalizeText(agent.assignedName).includes(search) ||
        normalizeText(agent.assignedTeam).includes(search) ||
        normalizeText(getAgentLocation(agent)).includes(search);

      const matchesScope = isManagement
        ? filters.viewScope === "all" ||
          (filters.viewScope === "my" && isAssignedToCurrentUser(agent, user))
        : isAssignedToCurrentUser(agent, user);

      const matchesAgentStatus =
        filters.agentStatus === "all" ||
        agent.agentStatus === filters.agentStatus;

      const matchesCategory =
        filters.category === "all" ||
        agent.category === filters.category;

      const matchesAssignment =
        filters.assignmentStatus === "all" ||
        agent.assignmentStatus === filters.assignmentStatus;

      const matchesPriority =
        filters.assignmentPriority === "all" ||
        agent.assignmentPriority === filters.assignmentPriority;

      const matchesTeam =
        !isManagement ||
        teamMatchesScope(agent.creatorTeam, scope.team || "all");

      const matchesRisk =
        filters.paymentRisk === "all" ||
        agent.paymentRisk === filters.paymentRisk;

      return (
        matchesSearch &&
        matchesScope &&
        matchesAgentStatus &&
        matchesCategory &&
        matchesAssignment &&
        matchesPriority &&
        matchesTeam &&
        matchesRisk
      );
    });
  }, [enrichedAgents, filters, isManagement, user, scope.team]);

  const activeFilterCount = useMemo(() => {
    const keys = [
      filters.search.trim(),
      filters.agentStatus !== "all",
      filters.category !== "all",
      filters.assignmentStatus !== "all",
      filters.assignmentPriority !== "all",
      filters.paymentRisk !== "all",
      isManagement && filters.viewScope !== "all"
    ];

    return keys.filter(Boolean).length;
  }, [filters, isManagement]);

  const resetFilters = () => {
    setFilters({
      ...INITIAL_AGENT_FILTERS,
      viewScope: isManagement ? "all" : "my"
    });
  };

  const selectedAgents = useMemo(() => {
    return enrichedAgents.filter(agent => selectedAgentIds.includes(agent.id));
  }, [enrichedAgents, selectedAgentIds]);

  const visibleAgentIds = useMemo(() => {
    return filteredAgents.map(agent => agent.id);
  }, [filteredAgents]);

  const allVisibleSelected = useMemo(() => {
    return (
      visibleAgentIds.length > 0 &&
      visibleAgentIds.every(id => selectedAgentIds.includes(id))
    );
  }, [visibleAgentIds, selectedAgentIds]);

  const toggleAgentSelection = agentId => {
    setSelectedAgentIds(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const toggleAllVisibleAgents = () => {
    setSelectedAgentIds(prev => {
      if (allVisibleSelected) {
        return prev.filter(id => !visibleAgentIds.includes(id));
      }

      return [...new Set([...prev, ...visibleAgentIds])];
    });
  };

  const clearSelection = () => {
    setSelectedAgentIds([]);
  };

  const summary = useMemo(() => {
    const totalAgents = filteredAgents.length;

    const activeAgents = filteredAgents.filter(
      agent => agent.agentStatus === "active"
    ).length;

    const invalidNumberAgents = filteredAgents.filter(
      agent => agent.agentStatus === "invalid_number"
    ).length;

    const businessShutAgents = filteredAgents.filter(
      agent => agent.agentStatus === "business_shut_down"
    ).length;

    const assignedAgents = filteredAgents.filter(
      agent => agent.assignmentStatus !== "Unassigned"
    ).length;

    const unassignedAgents = filteredAgents.filter(
      agent => agent.assignmentStatus === "Unassigned"
    ).length;

    const highValueAgents = filteredAgents.filter(agent =>
      ["A+", "A"].includes(agent.category)
    ).length;

    const highRiskAgents = filteredAgents.filter(
      agent => agent.paymentRisk === "High"
    ).length;

    const kycPending = filteredAgents.filter(
      agent => agent.kycStatus !== "Approved"
    ).length;

    const bankPending = filteredAgents.filter(
      agent => agent.bankStatus !== "Verified"
    ).length;

    const highPriority = filteredAgents.filter(agent =>
      ["High", "Critical"].includes(agent.assignmentPriority)
    ).length;

    const totalLeads = filteredAgents.reduce(
      (sum, agent) => sum + agent.totalLeads,
      0
    );

    const wonLeads = filteredAgents.reduce(
      (sum, agent) => sum + agent.wonLeads,
      0
    );

    const lostLeads = filteredAgents.reduce(
      (sum, agent) => sum + agent.lostLeads,
      0
    );

    const totalRevenue = filteredAgents.reduce(
      (sum, agent) => sum + agent.revenue,
      0
    );

    return {
      totalAgents,
      activeAgents,
      invalidNumberAgents,
      businessShutAgents,
      assignedAgents,
      unassignedAgents,
      highValueAgents,
      highRiskAgents,
      kycPending,
      bankPending,
      highPriority,
      totalLeads,
      wonLeads,
      lostLeads,
      totalRevenue,
      conversion: percentage(wonLeads, totalLeads)
    };
  }, [filteredAgents]);

  const periodAgents = useMemo(() => {
    return filteredAgents.filter(agent =>
      matchesAdminDateScope(
        getAgentCreatedAt(agent),
        scope.dateRange,
        scope.dateFrom,
        scope.dateTo
      )
    );
  }, [filteredAgents, scope.dateRange, scope.dateFrom, scope.dateTo]);

  const allPeriodEngagements = useMemo(() => {
    return engagements.filter(item =>
      matchesAdminDateScope(
        getEngagementDate(item),
        scope.dateRange,
        scope.dateFrom,
        scope.dateTo
      )
    );
  }, [engagements, scope.dateRange, scope.dateFrom, scope.dateTo]);

  const periodEngagements = useMemo(() => {
    if (!isManagement || (scope.team || "all") === "all") return allPeriodEngagements;

    return allPeriodEngagements.filter(item => {
      const performer = getEngagementIdentity(item, userLookup);
      return !performer.isUnmapped && teamMatchesScope(performer.team, scope.team);
    });
  }, [allPeriodEngagements, isManagement, scope.team, userLookup]);

  const firstCallByNewAgent = useMemo(() => {
    const newAgentIds = new Set(periodAgents.map(agent => agent.id).filter(Boolean));
    const firstCallMap = new Map();

    [...allPeriodEngagements]
      .filter(item => {
        const agentId = getEngagementAgentId(item);
        return normalizeText(item.channel) === "call" && newAgentIds.has(agentId);
      })
      .sort((a, b) => {
        const ad = toDate(getEngagementDate(a))?.getTime() || 0;
        const bd = toDate(getEngagementDate(b))?.getTime() || 0;
        return ad - bd;
      })
      .forEach(item => {
        const agentId = getEngagementAgentId(item);
        if (agentId && !firstCallMap.has(agentId)) firstCallMap.set(agentId, item);
      });

    return firstCallMap;
  }, [periodAgents, allPeriodEngagements]);

  const teamAcquisitionRows = useMemo(() => {
    const rows = new Map();

    const ensure = identity => {
      const key = identity?.key || "legacy-unmapped";
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          teamMember: identity?.name || "Legacy / Unmapped",
          email: identity?.email || "",
          isUnmapped: identity?.isUnmapped === true,
          newAgents: 0,
          contacted: 0,
          pendingFirstCall: 0,
          invalidNumber: 0,
          businessShutDown: 0
        });
      }
      return rows.get(key);
    };

    teamDirectory
      .filter(member => teamMatchesScope(member.team, scope.team || "all"))
      .forEach(member => ensure({
        key: member.key,
        name: member.name,
        email: member.email,
        isUnmapped: false
      }));

    periodAgents.forEach(agent => {
      const row = ensure(getCreatorIdentity(agent, userLookup));
      row.newAgents += 1;

      if (firstCallByNewAgent.has(agent.id)) row.contacted += 1;
      else row.pendingFirstCall += 1;

      const operationalStatus = normalizeTravelAgentStatus(agent.status, agent.active);
      if (operationalStatus === "invalid_number") row.invalidNumber += 1;
      if (operationalStatus === "business_shut_down") row.businessShutDown += 1;
    });

    return Array.from(rows.values())
      .map(row => ({
        ...row,
        contactRate: percentage(row.contacted, row.newAgents)
      }))
      .sort((a, b) => {
        if (a.isUnmapped !== b.isUnmapped) return a.isUnmapped ? 1 : -1;
        return b.newAgents - a.newAgents || b.contacted - a.contacted;
      });
  }, [periodAgents, firstCallByNewAgent, userLookup, teamDirectory, scope.team]);

  const teamActivityRows = useMemo(() => {
    const rows = new Map();

    const ensure = identity => {
      const key = identity?.key || "legacy-unmapped";
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          teamMember: identity?.name || "Legacy / Unmapped",
          email: identity?.email || "",
          isUnmapped: identity?.isUnmapped === true,
          firstCalls: 0,
          calls: 0,
          uniqueCalled: new Set(),
          whatsapp: 0,
          emails: 0,
          meetings: 0,
          totalTouches: 0,
          invalidAgentIds: new Set(),
          shutAgentIds: new Set(),
          lastActivityAt: null
        });
      }
      return rows.get(key);
    };

    teamDirectory
      .filter(member => teamMatchesScope(member.team, scope.team || "all"))
      .forEach(member => ensure({
        key: member.key,
        name: member.name,
        email: member.email,
        isUnmapped: false
      }));

    periodEngagements.forEach(item => {
      const row = ensure(getEngagementIdentity(item, userLookup));
      const agentId = getEngagementAgentId(item);
      const channel = normalizeText(item.channel);
      const outcome = normalizeText(item.outcomeCode || item.outcomeLabel || item.outcome);
      const activityDate = toDate(getEngagementDate(item));

      row.totalTouches += 1;
      if (activityDate && (!row.lastActivityAt || activityDate > row.lastActivityAt)) {
        row.lastActivityAt = activityDate;
      }

      if (channel === "call") {
        row.calls += 1;
        if (agentId) row.uniqueCalled.add(agentId);

        const firstCall = agentId ? firstCallByNewAgent.get(agentId) : null;
        if (firstCall && firstCall.id === item.id) row.firstCalls += 1;
      } else if (channel === "whatsapp") row.whatsapp += 1;
      else if (channel === "email") row.emails += 1;
      else if (channel === "meeting") row.meetings += 1;

      if (outcome === "invalid_number" && agentId) row.invalidAgentIds.add(agentId);
      if (outcome === "business_shut_down" && agentId) row.shutAgentIds.add(agentId);
    });

    return Array.from(rows.values())
      .map(row => ({
        ...row,
        followUpCalls: Math.max(row.calls - row.firstCalls, 0),
        uniqueCalled: row.uniqueCalled.size,
        invalidNumber: row.invalidAgentIds.size,
        businessShutDown: row.shutAgentIds.size,
        invalidAgentIds: undefined,
        shutAgentIds: undefined
      }))
      .sort((a, b) => {
        if (a.isUnmapped !== b.isUnmapped) return a.isUnmapped ? 1 : -1;
        return b.firstCalls - a.firstCalls || b.calls - a.calls || b.totalTouches - a.totalTouches;
      });
  }, [periodEngagements, firstCallByNewAgent, userLookup, teamDirectory, scope.team]);

  const teamAgentSummary = useMemo(() => {
    const callRows = periodEngagements.filter(item => normalizeText(item.channel) === "call");
    const uniqueCalled = new Set(callRows.map(getEngagementAgentId).filter(Boolean));
    const firstCallsCompleted = firstCallByNewAgent.size;
    const newAgents = periodAgents.length;

    return {
      newAgents,
      firstCallsCompleted,
      pendingFirstCalls: Math.max(newAgents - firstCallsCompleted, 0),
      contactRate: percentage(firstCallsCompleted, newAgents),
      totalCalls: callRows.length,
      uniqueCalled: uniqueCalled.size,
      unmappedAgents: teamAcquisitionRows
        .filter(row => row.isUnmapped)
        .reduce((sum, row) => sum + row.newAgents, 0)
    };
  }, [periodAgents, periodEngagements, firstCallByNewAgent, teamAcquisitionRows]);

  const revenueByAssignee = useMemo(() => {
    return groupSum(
      filteredAgents,
      agent => agent.assignedName || "Unassigned",
      agent => agent.revenue
    ).slice(0, 8);
  }, [filteredAgents]);

  const leadsByAssignee = useMemo(() => {
    return groupSum(
      filteredAgents,
      agent => agent.assignedName || "Unassigned",
      agent => agent.totalLeads
    ).slice(0, 8);
  }, [filteredAgents]);

  const revenueByCategory = useMemo(() => {
    return groupSum(
      filteredAgents,
      agent => agent.category || "B",
      agent => agent.revenue
    );
  }, [filteredAgents]);

  const assignmentDistribution = useMemo(() => {
    return groupSum(
      filteredAgents,
      agent => agent.assignmentStatus || "Unassigned",
      () => 1
    );
  }, [filteredAgents]);

  const cityWiseAgents = useMemo(() => {
    const map = {};

    filteredAgents.forEach(agent => {
      const city = getAgentLocation(agent) || "No city";

      if (!map[city]) {
        map[city] = {
          city,
          totalAgents: 0,
          activeAgents: 0,
          assignedAgents: 0,
          unassignedAgents: 0,
          highRiskAgents: 0,
          totalLeads: 0,
          revenue: 0
        };
      }

      map[city].totalAgents += 1;

      if (agent.agentStatus === "active") {
        map[city].activeAgents += 1;
      }

      if (agent.assignmentStatus === "Unassigned") {
        map[city].unassignedAgents += 1;
      } else {
        map[city].assignedAgents += 1;
      }

      if (agent.paymentRisk === "High") {
        map[city].highRiskAgents += 1;
      }

      map[city].totalLeads += agent.totalLeads;
      map[city].revenue += agent.revenue;
    });

    return Object.values(map).sort(
      (a, b) => b.totalAgents - a.totalAgents
    );
  }, [filteredAgents]);

  const lastTransactionAgents = useMemo(() => {
    return [...filteredAgents]
      .filter(agent => agent.lastTransactionAt)
      .sort((a, b) => {
        const ad = toDate(a.lastTransactionAt)?.getTime() || 0;
        const bd = toDate(b.lastTransactionAt)?.getTime() || 0;
        return bd - ad;
      })
      .slice(0, 8);
  }, [filteredAgents]);

  const topAgents = useMemo(() => {
    return [...filteredAgents]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [filteredAgents]);

  const attentionAgents = useMemo(() => {
    return [...filteredAgents]
      .filter(
        agent =>
          agent.assignmentStatus === "Unassigned" ||
          agent.paymentRisk === "High" ||
          agent.kycStatus !== "Approved" ||
          agent.bankStatus !== "Verified"
      )
      .sort((a, b) => {
        const score = item => {
          let value = 0;

          if (item.assignmentStatus === "Unassigned") value += 4;
          if (item.paymentRisk === "High") value += 3;
          if (item.kycStatus !== "Approved") value += 2;
          if (item.bankStatus !== "Verified") value += 1;
          if (["A+", "A"].includes(item.category)) value += 2;

          return value;
        };

        return score(b) - score(a);
      })
      .slice(0, 8);
  }, [filteredAgents]);

  const handleDeleteAgent = async () => {
    if (!isSuperAdmin || !deleteTarget?.id) return;

    try {
      setDeleting(true);

      await deleteDoc(doc(db, "travelAgents", deleteTarget.id));

      setDeleteTarget(null);

      if (selectedAgent?.id === deleteTarget.id) {
        setSelectedAgent(null);
      }

      clearSelection();
      await loadDashboard();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to delete travel agent.");
    } finally {
      setDeleting(false);
    }
  };

  const renderAgentActions = agent => {
    return (
      <div className="flex justify-end gap-3 text-xs">
        <button
          type="button"
          onClick={() => setSelectedAgent(agent)}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
        >
          <Eye className="h-3.5 w-3.5" />
          Quick
        </button>

        <Link
          href={`/admin/travel-agents/${agent.id}`}
          className="text-blue-600 hover:underline"
        >
          View
        </Link>

        {isManagement && (
          <button
            type="button"
            onClick={() => setAssignTarget(agent)}
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {agent.assignmentStatus === "Unassigned" ? "Assign" : "Reassign"}
          </button>
        )}

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setDeleteTarget(agent)}
            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <AdminGuard>
        <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
          <div className="mx-auto max-w-[1600px] space-y-4">
            <div className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map(item => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          </div>
        </main>
      </AdminGuard>
    );
  }

  if (loadError) {
    return (
      <AdminGuard>
        <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
          <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">
              Unable to load travel agent dashboard
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {loadError}
            </p>
            <button
              type="button"
              onClick={loadDashboard}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#f8fafc_34%,#f8fafc_100%)] p-4 md:p-6">
        <div className="mx-auto max-w-[1600px] space-y-5">
          {/* HEADER */}
          <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_12px_36px_rgba(37,99,235,0.07)]">
            <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link
                  href="/admin/travel-agents"
                  className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-100 hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back to Travel Agents
                </Link>

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white">
                    <BarChart3 size={22} />
                  </div>

                  <div>
                    <h1 className="text-xl font-semibold text-white">
                      {isManagement
                        ? "Travel Agent Management Dashboard"
                        : "My Travel Agent Dashboard"}
                    </h1>

                    <p className="mt-1 max-w-3xl text-sm text-blue-100">
                      {isManagement
                        ? "Monitor assignment, city distribution, transactions, revenue, risk and agent performance."
                        : "Track your assigned agents, transactions, leads, revenue, risk and priorities."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {isManagement && (
                  <Link
                    href="/admin/travel-agents/assigned"
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                  >
                    Assigned Agents
                  </Link>
                )}

                <Link
                  href="/admin/travel-agents/my-assigned"
                  className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                >
                  My Assigned
                </Link>

                <button
                  type="button"
                  onClick={loadDashboard}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            </div>
          </div>

          {/* FILTERS */}
          <div className="sticky top-20 z-30 rounded-2xl border border-slate-200 bg-white/95 p-4  backdrop-blur">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-blue-600" />
                <p className="text-sm font-semibold text-slate-900">
                  {isManagement ? "Travel Agent Portfolio Filters" : "My Travel Agent Filters"}
                </p>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {activeFilterCount} active
                  </span>
                ) : null}
              </div>

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Filters
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
              <input
                type="search"
                aria-label="Search travel agents"
                value={filters.search}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    search: e.target.value
                  }))
                }
                placeholder={
                  isManagement
                    ? "Search agent / city / assignee..."
                    : "Search my agents / city..."
                }
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 md:col-span-2"
              />

              <Select
                value={filters.agentStatus}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    agentStatus: value
                  }))
                }
              >
                <option value="all">All Statuses</option>
                {TRAVEL_AGENT_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              {isManagement && (
                <Select
                  value={filters.viewScope}
                  onChange={value =>
                    setFilters(prev => ({
                      ...prev,
                      viewScope: value
                    }))
                  }
                >
                  <option value="all">All Agents</option>
                  <option value="my">My Assigned</option>
                </Select>
              )}

              <Select
                value={filters.category}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    category: value
                  }))
                }
              >
                <option value="all">All Category</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </Select>

              <Select
                value={filters.assignmentStatus}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    assignmentStatus: value
                  }))
                }
              >
                <option value="all">Assignment</option>
                <option value="Assigned">Assigned</option>
                <option value="Reassigned">Reassigned</option>
                <option value="Unassigned">Unassigned</option>
                <option value="On Hold">On Hold</option>
              </Select>

              <Select
                value={filters.assignmentPriority}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    assignmentPriority: value
                  }))
                }
              >
                <option value="all">Priority</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>

              <Select
                value={filters.paymentRisk}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    paymentRisk: value
                  }))
                }
              >
                <option value="all">Payment Risk</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
              </Select>

            </div>
            <p className="mt-2 text-xs text-slate-400">Global Date + Team apply above. Agent acquisition is scoped by Agent Created By; engagement activity is scoped by Activity Performed By.</p>
          </div>

          {/* KPI ROW 1 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <KpiCard
              label={isManagement ? "Agents" : "My Agents"}
              value={summary.totalAgents}
              icon={<Building2 size={18} />}
            />

            <KpiCard
              label={isManagement ? "Assigned" : "Active Assigned"}
              value={isManagement ? summary.assignedAgents : summary.activeAgents}
              icon={<UserCheck size={18} />}
              tone="green"
            />

            {isManagement ? (
              <KpiCard
                label="Unassigned"
                value={summary.unassignedAgents}
                icon={<AlertTriangle size={18} />}
                tone="amber"
              />
            ) : (
              <KpiCard
                label="High Priority"
                value={summary.highPriority}
                icon={<AlertTriangle size={18} />}
                tone="amber"
              />
            )}

            <KpiCard
              label="A+ / A"
              value={summary.highValueAgents}
              icon={<BadgeCheck size={18} />}
              tone="purple"
            />

            <KpiCard
              label="High Risk"
              value={summary.highRiskAgents}
              icon={<CreditCard size={18} />}
              tone={summary.highRiskAgents > 0 ? "red" : "green"}
            />

            <KpiCard
              label="KYC Pending"
              value={summary.kycPending}
              icon={<ShieldCheck size={18} />}
              tone={summary.kycPending > 0 ? "amber" : "green"}
            />
          </div>

          {/* KPI ROW 2 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={isManagement ? "Total Leads" : "My Leads"}
              value={summary.totalLeads}
              icon={<Users size={18} />}
              tone="blue"
            />

            <KpiCard
              label="Won Deals"
              value={summary.wonLeads}
              icon={<CheckCircle2 size={18} />}
              tone="green"
            />

            <KpiCard
              label={isManagement ? "Revenue" : "My Revenue"}
              value={formatCurrency(summary.totalRevenue)}
              icon={<IndianRupee size={18} />}
              tone="purple"
            />

            <KpiCard
              label={isManagement ? "Conversion" : "My Conversion"}
              value={`${summary.conversion}%`}
              icon={<TrendingUp size={18} />}
              tone="blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Active Agents" value={summary.activeAgents} icon={<CheckCircle2 size={18} />} tone="green" />
            <KpiCard label="Invalid Number" value={summary.invalidNumberAgents} icon={<AlertTriangle size={18} />} tone={summary.invalidNumberAgents ? "red" : "green"} />
            <KpiCard label="Business Shut Down" value={summary.businessShutAgents} icon={<Building2 size={18} />} tone={summary.businessShutAgents ? "amber" : "green"} />
            <KpiCard label="Visible Records" value={summary.totalAgents} icon={<Users size={18} />} tone="blue" />
          </div>

          {/* CITY + TRANSACTION PANELS */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CityWiseAgentPanel
              data={cityWiseAgents}
              valueFormatter={formatCurrency}
            />

            <LastTransactionAgentPanel
              agents={lastTransactionAgents}
              valueFormatter={formatCurrency}
              actions={renderAgentActions}
            />
          </div>

          {isManagement && (
            <TeamAgentPerformancePanels
              summary={teamAgentSummary}
              acquisitionRows={teamAcquisitionRows}
              activityRows={teamActivityRows}
            />
          )}

          {/* MANAGEMENT PANELS */}
          {isManagement && (
            <div className="grid gap-4 lg:grid-cols-2">
              <BarPanel
                title="Revenue by Assigned User"
                subtitle="Top assignees by won deal revenue"
                data={revenueByAssignee}
                valueFormatter={formatCurrency}
              />

              <BarPanel
                title="Leads by Assigned User"
                subtitle="Lead volume ownership by team member"
                data={leadsByAssignee}
              />

              <BarPanel
                title="Revenue by Category"
                subtitle="A+ / A / B / C partner contribution"
                data={revenueByCategory}
                valueFormatter={formatCurrency}
              />

              <BarPanel
                title="Assignment Distribution"
                subtitle="Assigned, reassigned, unassigned and on-hold split"
                data={assignmentDistribution}
              />
            </div>
          )}

          {/* TOP + ATTENTION */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  {isManagement ? "Top Performing Agents" : "My Top Agents"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Ranked by revenue from won leads.
                </p>
              </div>

              <div className="space-y-3">
                {topAgents.length === 0 ? (
                  <EmptyPanel text="No performance data found." />
                ) : (
                  topAgents.map(agent => (
                    <AgentMiniRow
                      key={agent.id}
                      agent={agent}
                      rightValue={formatCurrency(agent.revenue)}
                      subValue={`${agent.totalLeads} leads • ${agent.conversion}% conversion`}
                      actions={renderAgentActions(agent)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  {isManagement ? "Attention Required" : "My Attention Required"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {isManagement
                    ? "Unassigned, high-risk, KYC pending or bank pending agents."
                    : "High-risk, KYC pending or bank pending assigned agents."}
                </p>
              </div>

              <div className="space-y-3">
                {attentionAgents.length === 0 ? (
                  <EmptyPanel text="No urgent agent issues found." />
                ) : (
                  attentionAgents.map(agent => (
                    <AgentMiniRow
                      key={agent.id}
                      agent={agent}
                      rightValue={
                        isManagement
                          ? agent.assignmentStatus
                          : agent.paymentRisk
                      }
                      subValue={`${agent.paymentRisk} risk • KYC ${agent.kycStatus} • Bank ${agent.bankStatus}`}
                      actions={renderAgentActions(agent)}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* BULK ASSIGN BAR */}
          {isManagement && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-900">
                    Bulk Assignment
                  </p>

                  <p className="mt-1 text-xs text-indigo-700">
                    {selectedAgents.length > 0
                      ? `${selectedAgents.length} travel agent${
                          selectedAgents.length === 1 ? "" : "s"
                        } selected`
                      : "Select travel agents from the table below to assign in bulk."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkAssignOpen(true)}
                    disabled={selectedAgents.length === 0}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserCheck className="h-4 w-4" />
                    Bulk Assign
                  </button>

                  {selectedAgents.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="h-9 rounded-xl border border-indigo-200 bg-white px-4 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DEMOGRAPHIC / ASSIGNMENT TABLE */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                {isManagement
                  ? "Travel Agent Demographic Overview"
                  : "My Assigned Agent Overview"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Agency profile, location, destinations, last transaction,
                assignment, compliance and operational status.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1460px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[inset_0_-1px_0_#e2e8f0]">
                  <tr>
                    {isManagement && (
                      <th className="w-10 px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisibleAgents}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                          aria-label="Select all visible agents"
                        />
                      </th>
                    )}

                    <Th>Agency</Th>
                    <Th>Category / Segment</Th>
                    <Th>Location</Th>
                    <Th>Destinations</Th>
                    <Th>Last Transaction</Th>
                    {isManagement && <Th>Assigned To</Th>}
                    <Th>Assignment</Th>
                    <Th>Compliance</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isManagement ? 10 : 9}
                        className="px-6 py-14 text-center"
                      >
                        <div className="mx-auto max-w-sm">
                          <Filter className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-3 text-sm font-semibold text-slate-800">
                            No travel agents match these filters
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Clear one or more filters to widen the dashboard view.
                          </p>
                          {activeFilterCount > 0 ? (
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset Filters
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}

                  {filteredAgents.map(agent => {
                    const agentDestinations = getAgentDestinations(agent);

                    return (
                      <tr
                        key={agent.id}
                        className="border-b border-slate-100 hover:bg-slate-50/70"
                      >
                        {isManagement && (
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedAgentIds.includes(agent.id)}
                              onChange={() => toggleAgentSelection(agent.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                              aria-label={`Select ${agent.agentName}`}
                            />
                          </td>
                        )}

                        <Td>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {agent.agentName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {agent.agentCode || "No code"}
                            </p>
                          </div>
                        </Td>

                        <Td>
                          <div className="space-y-1">
                            <CategoryBadge value={agent.category} />

                            <p className="text-xs text-slate-500">
                              {getPartnerSegment(agent)}
                            </p>
                          </div>
                        </Td>

                        <Td>
                          <p className="text-sm text-slate-700">
                            {getAgentLocation(agent)}
                          </p>
                        </Td>

                        <Td>
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {agentDestinations.slice(0, 3).map((destination, index) => (
                              <span
                                key={`${destination.id}-${index}`}
                                className="rounded-md bg-slate-100 px-2 py-[2px] text-[11px] font-medium text-slate-700"
                              >
                                {destination.name}
                              </span>
                            ))}

                            {agentDestinations.length > 3 && (
                              <span className="text-[11px] text-slate-500">
                                +{agentDestinations.length - 3} more
                              </span>
                            )}

                            {agentDestinations.length === 0 && (
                              <span className="text-xs text-slate-400">
                                No destinations
                              </span>
                            )}
                          </div>
                        </Td>

                        <Td>
                          {agent.lastTransactionAt ? (
                            <div>
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(agent.lastTransactionAmount)}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {formatDateTime(agent.lastTransactionAt)}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {agent.lastTransactionDirection}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              No transaction
                            </span>
                          )}
                        </Td>

                        {isManagement && (
                          <Td>
                            <div>
                              <p className="font-medium text-slate-800">
                                {agent.assignedName || "Not assigned"}
                              </p>

                              {agent.assignedTeam && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {agent.assignedTeam}
                                </p>
                              )}
                            </div>
                          </Td>
                        )}

                        <Td>
                          <div className="flex flex-wrap gap-1">
                            <SoftBadge value={agent.assignmentStatus} />
                            <PriorityBadge value={agent.assignmentPriority} />
                          </div>
                        </Td>

                        <Td>
                          <div className="flex flex-wrap gap-1">
                            <RiskBadge value={agent.paymentRisk} />
                            <KycBadge value={agent.kycStatus} />
                            <BankBadge value={agent.bankStatus} />
                          </div>
                        </Td>

                        <Td>
                          <StatusBadge value={agent.agentStatus} />
                        </Td>

                        <Td align="right">
                          {renderAgentActions(agent)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* QUICK VIEW DRAWER */}
        {selectedAgent && (
          <AgentSideDrawer
            agent={selectedAgent}
            destinations={getAgentDestinations(selectedAgent)}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        {/* ASSIGN MODAL */}
        <AssignTravelAgentModal
          open={!!assignTarget}
          agent={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={async () => {
            setAssignTarget(null);
            await loadDashboard();
          }}
        />

        {/* BULK ASSIGN MODAL */}
        <BulkAssignTravelAgentModal
          open={bulkAssignOpen}
          agents={selectedAgents}
          onClose={() => setBulkAssignOpen(false)}
          onAssigned={async () => {
            setBulkAssignOpen(false);
            clearSelection();
            await loadDashboard();
          }}
        />

        {/* DELETE MODAL */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-50 p-2 text-red-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>

                <div className="flex-1">
                  <h2 className="text-base font-semibold text-slate-900">
                    Delete travel agent?
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    This will permanently delete{" "}
                    <span className="font-medium text-slate-800">
                      {deleteTarget.agentName ||
                        deleteTarget.agencyName ||
                        "this agency"}
                    </span>
                    . This action cannot be undone.
                  </p>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      disabled={deleting}
                      className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteAgent}
                      disabled={deleting}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminGuard>
  );
}

/* =========================
   UI COMPONENTS
========================= */

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
    >
      {children}
    </select>
  );
}

function KpiCard({ label, value, icon, tone = "slate" }) {
  const tones = {
    slate: { card: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-700" },
    green: { card: "border-emerald-100 bg-emerald-50/55", icon: "bg-emerald-100 text-emerald-700" },
    amber: { card: "border-amber-100 bg-amber-50/60", icon: "bg-amber-100 text-amber-700" },
    blue: { card: "border-blue-100 bg-blue-50/55", icon: "bg-blue-100 text-blue-700" },
    purple: { card: "border-purple-100 bg-purple-50/55", icon: "bg-purple-100 text-purple-700" },
    red: { card: "border-red-100 bg-red-50/60", icon: "bg-red-100 text-red-700" }
  };

  const currentTone = tones[tone] || tones.slate;

  return (
    <div className={`min-h-[112px] rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${currentTone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 break-words text-xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${currentTone.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function CompactMetric({ label, value, helper = "" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-[11px] text-slate-400">{helper}</p> : null}
    </div>
  );
}

function TeamAgentPerformancePanels({ summary, acquisitionRows = [], activityRows = [] }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">New Agent Acquisition</h2>
            <p className="mt-1 text-sm text-slate-500">
              Acquisition credit follows the team member who created the travel-agent master record.
            </p>
          </div>
          <p className="text-xs text-slate-400">Called = unique new agent with at least one call in the selected period</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <CompactMetric label="New Agents" value={summary.newAgents} />
          <CompactMetric label="First Calls Done" value={summary.firstCallsCompleted} helper="One per new agent" />
          <CompactMetric label="Pending First Call" value={summary.pendingFirstCalls} />
          <CompactMetric label="Contact Rate" value={`${summary.contactRate}%`} />
          <CompactMetric label="All Calls" value={summary.totalCalls} />
          <CompactMetric label="Unique Agents Called" value={summary.uniqueCalled} />
        </div>

        {!acquisitionRows.length ? (
          <EmptyPanel text="No new-agent acquisition data found for the selected filters." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {["Team Member", "New Agents", "Called", "Pending First Call", "Contact Rate", "Invalid No.", "Business Shut"].map((label, index) => (
                    <th key={label} className={`px-3 py-3 font-semibold ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {acquisitionRows.map(row => (
                  <tr key={row.key} className={row.isUnmapped ? "bg-amber-50/60" : "hover:bg-slate-50/70"}>
                    <td className="px-3 py-3 text-left">
                      <div className="font-semibold text-slate-900">{row.teamMember}</div>
                      {row.email ? <div className="mt-0.5 text-[11px] text-slate-400">{row.email}</div> : null}
                      {row.isUnmapped ? <div className="mt-0.5 text-[11px] text-amber-700">Legacy records missing a resolvable creator</div> : null}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-blue-700">{row.newAgents}</td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-700">{row.contacted}</td>
                    <td className="px-3 py-3 text-right font-semibold text-amber-700">{row.pendingFirstCall}</td>
                    <td className="px-3 py-3 text-right">{row.contactRate}%</td>
                    <td className="px-3 py-3 text-right text-rose-700">{row.invalidNumber}</td>
                    <td className="px-3 py-3 text-right text-amber-700">{row.businessShutDown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summary.unmappedAgents > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {summary.unmappedAgents} legacy agent record{summary.unmappedAgents === 1 ? " is" : "s are"} missing a resolvable creator. These records are grouped separately and should not be used for individual performance scoring.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Team Calling & Engagement</h2>
            <p className="mt-1 text-sm text-slate-500">
              Activity credit follows the person who logged the call or engagement.
            </p>
          </div>
          <p className="text-xs text-slate-400">First Call = one credit per new agent; repeated calls never increase it</p>
        </div>

        {!activityRows.length ? (
          <EmptyPanel text="No team engagement activity found for the selected filters." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1040px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {["Team Member", "First Calls", "Other / Follow-up Calls", "Total Calls", "Unique Agents Called", "WhatsApp", "Meetings", "Total Touches", "Last Activity"].map((label, index) => (
                    <th key={label} className={`px-3 py-3 font-semibold ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityRows.map(row => (
                  <tr key={row.key} className={row.isUnmapped ? "bg-amber-50/60" : "hover:bg-slate-50/70"}>
                    <td className="px-3 py-3 text-left">
                      <div className="font-semibold text-slate-900">{row.teamMember}</div>
                      {row.email ? <div className="mt-0.5 text-[11px] text-slate-400">{row.email}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-700">{row.firstCalls}</td>
                    <td className="px-3 py-3 text-right">{row.followUpCalls}</td>
                    <td className="px-3 py-3 text-right font-semibold text-blue-700">{row.calls}</td>
                    <td className="px-3 py-3 text-right">{row.uniqueCalled}</td>
                    <td className="px-3 py-3 text-right">{row.whatsapp}</td>
                    <td className="px-3 py-3 text-right">{row.meetings}</td>
                    <td className="px-3 py-3 text-right font-medium">{row.totalTouches}</td>
                    <td className="px-3 py-3 text-right text-xs text-slate-500">{formatDateTime(row.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BarPanel({ title, subtitle, data, valueFormatter = value => value }) {
  const max = Math.max(...data.map(item => Number(item.value || 0)), 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {data.length === 0 ? (
        <EmptyPanel text="No data found." />
      ) : (
        <div className="space-y-3">
          {data.map(item => {
            const width = Math.max((Number(item.value || 0) / max) * 100, 4);

            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-slate-700">
                    {item.label}
                  </span>

                  <span className="font-semibold text-slate-900">
                    {valueFormatter(item.value)}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CityWiseAgentPanel({ data, valueFormatter }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <MapPin size={18} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            City-wise Travel Agents
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Agent distribution by city with revenue and lead volume.
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyPanel text="No city-wise data found." />
      ) : (
        <div className="space-y-3">
          {data.slice(0, 8).map(item => (
            <div
              key={item.city}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.city}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.activeAgents} active • {item.assignedAgents} assigned •{" "}
                    {item.unassignedAgents} unassigned
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {item.totalAgents}
                  </p>
                  <p className="text-xs text-slate-500">agents</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-slate-400">Leads</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {item.totalLeads}
                  </p>
                </div>

                <div className="rounded-lg bg-white p-2">
                  <p className="text-slate-400">Revenue</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {valueFormatter(item.revenue)}
                  </p>
                </div>

                <div className="rounded-lg bg-white p-2">
                  <p className="text-slate-400">High Risk</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {item.highRiskAgents}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LastTransactionAgentPanel({ agents, valueFormatter, actions }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Clock size={18} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Last Transaction Agents
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Recently paid or received transaction activity.
          </p>
        </div>
      </div>

      {agents.length === 0 ? (
        <EmptyPanel text="No transaction activity found." />
      ) : (
        <div className="space-y-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {agent.agentName}
                  </p>

                  <p className="mt-1 truncate text-xs text-slate-500">
                    {agent.assignedName || "Not assigned"} •{" "}
                    {agent.lastTransactionDirection}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {valueFormatter(agent.lastTransactionAmount)}
                  </p>

                  <p className="text-xs text-slate-500">
                    {formatDateTime(agent.lastTransactionAt)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded-md bg-white px-2 py-[2px] text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                  {agent.lastTransactionMode}
                </span>

                <span className="rounded-md bg-blue-50 px-2 py-[2px] text-[11px] font-medium text-blue-700">
                  {agent.transactionCount} transactions
                </span>

                <span className="rounded-md bg-emerald-50 px-2 py-[2px] text-[11px] font-medium text-emerald-700">
                  {valueFormatter(agent.transactionValue)}
                </span>
              </div>

              {actions && (
                <div className="mt-3 flex justify-end border-t border-slate-200 pt-2">
                  {actions(agent)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AgentMiniRow({ agent, rightValue, subValue, actions }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {agent.agentName}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {agent.assignedName || "Not assigned"} • {subValue}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-slate-900">
            {rightValue}
          </p>
        </div>
      </div>

      {actions && (
        <div className="mt-3 flex justify-end border-t border-slate-200 pt-2">
          {actions}
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function Th({ children, align = "left" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <th
      className={`whitespace-nowrap px-4 py-3 ${alignClass} text-xs font-semibold uppercase tracking-wide text-slate-500`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left", className = "" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <td
      className={`whitespace-nowrap px-4 py-4 ${alignClass} text-sm text-slate-700 ${className}`}
    >
      {children}
    </td>
  );
}

function CategoryBadge({ value }) {
  const style =
    value === "A+"
      ? "bg-purple-50 text-purple-700"
      : value === "A"
      ? "bg-emerald-50 text-emerald-700"
      : value === "C"
      ? "bg-slate-100 text-slate-600"
      : "bg-blue-50 text-blue-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      {value || "B"}
    </span>
  );
}

function SoftBadge({ value }) {
  const style =
    value === "Assigned"
      ? "bg-emerald-50 text-emerald-700"
      : value === "Reassigned"
      ? "bg-blue-50 text-blue-700"
      : value === "On Hold"
      ? "bg-slate-100 text-slate-600"
      : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      {value || "Unassigned"}
    </span>
  );
}

function PriorityBadge({ value }) {
  const style =
    value === "Critical"
      ? "bg-red-50 text-red-700"
      : value === "High"
      ? "bg-orange-50 text-orange-700"
      : value === "Low"
      ? "bg-slate-100 text-slate-600"
      : "bg-blue-50 text-blue-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      {value || "Medium"}
    </span>
  );
}

function RiskBadge({ value }) {
  const style =
    value === "High"
      ? "bg-red-50 text-red-700"
      : value === "Medium"
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      {value || "Low"} Risk
    </span>
  );
}

function KycBadge({ value }) {
  const style =
    value === "Approved"
      ? "bg-emerald-50 text-emerald-700"
      : value === "Rejected"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      KYC {value || "Pending"}
    </span>
  );
}

function BankBadge({ value }) {
  const style =
    value === "Verified"
      ? "bg-emerald-50 text-emerald-700"
      : value === "Rejected"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      Bank {value || "Pending"}
    </span>
  );
}

function StatusBadge({ value }) {
  const meta = getTravelAgentStatusMeta(value);
  const style = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600"
  }[meta.tone] || "bg-slate-100 text-slate-600";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      {meta.label}
    </span>
  );
}