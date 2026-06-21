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
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  Users
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
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

const isWithinRange = (value, range) => {
  if (range === "all") return true;

  const date = toDate(value);
  if (!date) return false;

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (range === "30d") return days <= 30;
  if (range === "90d") return days <= 90;
  if (range === "180d") return days <= 180;
  if (range === "365d") return days <= 365;

  return true;
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

const getAgentStatus = agent => {
  const status = normalizeText(agent.status);

  if (status === "active" || agent.active === true) return "active";
  if (status === "blacklisted") return "blacklisted";

  return "inactive";
};

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
   PAGE
========================= */

export default function TravelAgentDashboardPage() {
  const { user } = useAuth();

  const isManagement = isManagementUser(user);
  const isSuperAdmin = isSuperAdminUser(user);

  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedAgent, setSelectedAgent] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    dateRange: "all",
    category: "all",
    assignmentStatus: "all",
    assignmentPriority: "all",
    assignedTeam: "all",
    assignedUser: "all",
    paymentRisk: "all",
    viewScope: "all"
  });

  useEffect(() => {
    if (!user) return;

    if (!isManagement) {
      setFilters(prev => ({
        ...prev,
        viewScope: "my",
        assignedTeam: "all",
        assignedUser: "all"
      }));
    }
  }, [user, isManagement]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const [agentSnap, leadSnap, destinationSnap, paymentSnapshots] =
        await Promise.all([
          getDocs(collection(db, "travelAgents")),
          getDocs(collection(db, "leads")),
          getDocs(collection(db, "destinations")),
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

      setTransactions(paymentSnapshots.flat());
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to load travel agent dashboard.");
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

  const assignedTeamOptions = useMemo(() => {
    return [
      ...new Set(
        agents
          .map(agent => getAssignedTeam(agent))
          .filter(Boolean)
      )
    ].sort();
  }, [agents]);

  const assignedUserOptions = useMemo(() => {
    return [
      ...new Set(
        agents
          .map(agent => getAssignedName(agent))
          .filter(Boolean)
      )
    ].sort();
  }, [agents]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead =>
      isWithinRange(getLeadCreatedAt(lead), filters.dateRange)
    );
  }, [leads, filters.dateRange]);

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

      return {
        ...agent,
        agentName: getAgentName(agent),
        agentStatus: getAgentStatus(agent),
        category: getAgentCategory(agent),
        paymentRisk: getPaymentRisk(agent),
        kycStatus: getKycStatus(agent),
        bankStatus: getBankStatus(agent),
        assignedUid: getAssignedUid(agent),
        assignedName: getAssignedName(agent),
        assignedTeam: getAssignedTeam(agent),
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
  }, [agents, leadMapByAgent, transactionMapByAgent]);

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
        filters.assignedTeam === "all" ||
        agent.assignedTeam === filters.assignedTeam;

      const matchesUser =
        !isManagement ||
        filters.assignedUser === "all" ||
        agent.assignedName === filters.assignedUser;

      const matchesRisk =
        filters.paymentRisk === "all" ||
        agent.paymentRisk === filters.paymentRisk;

      return (
        matchesSearch &&
        matchesScope &&
        matchesCategory &&
        matchesAssignment &&
        matchesPriority &&
        matchesTeam &&
        matchesUser &&
        matchesRisk
      );
    });
  }, [enrichedAgents, filters, isManagement, user]);

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
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Loading travel agent dashboard...
            </p>
          </div>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="min-h-screen p-4 md:p-6">
        <div className="mx-auto max-w-9xl space-y-5">
          {/* HEADER */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 ">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link
                  href="/admin/travel-agents"
                  className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-700"
                >
                  <ArrowLeft size={16} />
                  Back to Travel Agents
                </Link>

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <BarChart3 size={22} />
                  </div>

                  <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                      {isManagement
                        ? "Travel Agent Management Dashboard"
                        : "My Travel Agent Dashboard"}
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
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
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Assigned Agents
                  </Link>
                )}

                <Link
                  href="/admin/travel-agents/my-assigned"
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  My Assigned
                </Link>
              </div>
            </div>
          </div>

          {/* FILTERS */}
          <div className="sticky top-20 z-30 rounded-2xl border border-slate-200 bg-white/95 p-4  backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <Filter size={16} className="text-blue-600" />
              <p className="text-sm font-semibold text-slate-900">
                {isManagement ? "Dashboard Filters" : "My Dashboard Filters"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
              <input
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
                value={filters.dateRange}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    dateRange: value
                  }))
                }
              >
                <option value="all">All Time</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="180d">Last 180 Days</option>
                <option value="365d">Last 365 Days</option>
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

              {isManagement && (
                <>
                  <Select
                    value={filters.assignedTeam}
                    onChange={value =>
                      setFilters(prev => ({
                        ...prev,
                        assignedTeam: value
                      }))
                    }
                  >
                    <option value="all">All Teams</option>
                    {assignedTeamOptions.map(team => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={filters.assignedUser}
                    onChange={value =>
                      setFilters(prev => ({
                        ...prev,
                        assignedUser: value
                      }))
                    }
                  >
                    <option value="all">All Users</option>
                    {assignedUserOptions.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </>
              )}
            </div>
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            <section className="rounded-2xl border border-slate-200 bg-white p-5 ">
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 ">
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
          <section className="rounded-2xl border border-slate-200 bg-white ">
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
                <thead className="bg-slate-50 text-xs text-slate-500">
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
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
    >
      {children}
    </select>
  );
}

function KpiCard({ label, value, icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    red: "bg-red-50 text-red-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <div
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
          tones[tone] || tones.slate
        }`}
      >
        {icon}
      </div>

      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function BarPanel({ title, subtitle, data, valueFormatter = value => value }) {
  const max = Math.max(...data.map(item => Number(item.value || 0)), 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 ">
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 ">
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 ">
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
  const style =
    value === "active"
      ? "bg-emerald-50 text-emerald-700"
      : value === "blacklisted"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-600";

  const label =
    value === "active"
      ? "Active"
      : value === "blacklisted"
      ? "Blacklisted"
      : "Inactive";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] font-medium ${style}`}>
      {label}
    </span>
  );
}