"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Eye,
  Handshake,
  IndianRupee,
  Layers3,
  LayoutDashboard,
  LineChart,
  PieChart,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { normalizeTravelAgentStatus } from "@/lib/travelAgentStatus";
import { useAuth } from "@/hooks/useAuth";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { getAdminDateWindow } from "@/lib/adminScope";
import { resolveDirectoryIdentity, teamMatchesScope } from "@/lib/teamDirectory";

/* DASHBOARD COMPONENTS */
import DashboardKpiCard from "@/components/admin/dashboard/DashboardKpiCard";

/* ENGAGEMENT COMPONENTS */
import EngagementKpiCard from "@/components/admin/dashboard/engagements/EngagementKpiCard";

const chartLoading = () => (
  <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
    Loading chart…
  </div>
);

const LeadsTrendChart = dynamic(
  () => import("@/components/admin/dashboard/LeadsTrendChart"),
  { ssr: false, loading: chartLoading }
);
const LeadsByStageChart = dynamic(
  () => import("@/components/admin/dashboard/LeadsByStageChart"),
  { ssr: false, loading: chartLoading }
);
const LeadsByDestinationChart = dynamic(
  () => import("@/components/admin/dashboard/LeadsByDestinationChart"),
  { ssr: false, loading: chartLoading }
);
const EngagementByChannelChart = dynamic(
  () => import("@/components/admin/dashboard/engagements/EngagementByChannelChart"),
  { ssr: false, loading: chartLoading }
);

import * as dashboardHelpers from "@/lib/dashboard/managementDashboardHelpers";
import {
  KPI_TONES, DashboardSkeleton, ExecutiveKpiCard, DashboardGraphCard, MiniColumnGraph, SectionHeader,
  BusinessPulseCard, FinanceFlowCard, InsightCards, ChartShell, MiniBarList,
  AttentionRequiredPanel, ManagementOverviewTable, ManagementFinanceTable,
  ManagementVendorTable, ManagementLeadsTable, ManagementEngagementTable,
  ManagementTeamTable, DashboardDetailDrawer, isSameDashboardMember
} from "@/components/admin/dashboard/management/ManagementDashboardUi";

/* =========================
   FIRESTORE COLLECTIONS
========================== */

const LEADS_COLLECTION = "leads";
const ENGAGEMENT_COLLECTION = "engagements";
const TRAVEL_AGENTS_COLLECTION = "travelAgents";


const {
  getUniqueHighValueAttentionRows,
  toDate,
  normalize,
  toAmount,
  isInRange,
  formatCurrency,
  formatDateTime,
  formatNameFromEmail,
  countBy,
  sumBy,
  getRangeLabel,
  isDeletedLead,
  getActiveLeads,
  getLeadDate,
  getLeadActivityDate,
  hasLeadAssignee,
  isWonLead,
  isLostLead,
  isCancelledInvalidLead,
  getLeadWonDate,
  getLeadLostDate,
  getLeadCancelledInvalidDate,
  getQuotationDate,
  getPaymentDate,
  isInSelectedRangeByDate,
  isActiveLead,
  getLeadQuotationAmount,
  getLeadVendorCost,
  getLeadGrossProfit,
  getLeadActualRealizedGrossProfit,
  getLeadUnrealizedGrossProfit,
  getLeadReceivedAmount,
  getLeadVendorPaymentBalance,
  getLeadVendorPaidAmount,
  hasQuotationSent,
  hasVendorRequest,
  hasVendorQuoteReceived,
  isVendorQuotePending,
  isVendorSelected,
  getLeadOwner,
  getLeadAssignee,
  getLeadCreator,
  getEngagementDate,
  getEngagementOwner,
  getEngagementDestinationList,
  getTravelAgentDate,
  getTravelAgentCreator,
  getEngagementTravelAgentId
} = dashboardHelpers;

/* =========================
   MAIN MANAGEMENT DASHBOARD
========================== */

export default function AdminDashboardGraph() {
  const router = useRouter();
  const { user, loading, error } = useAuth("admin");
  const {
    scope,
    userLookup: globalUserLookup,
    teamDirectory,
    allUserDirectory,
    usersLoading
  } = useAdminScope();

  const mountTimeRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now()
  );
  const authLoggedRef = useRef(false);

  const range = scope.dateRange || "30d";
  const [activeTab, setActiveTab] = useState("overview");

  const [leads, setLeads] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [travelAgents, setTravelAgents] = useState([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [selectedMetricPanel, setSelectedMetricPanel] = useState(null);

  const openInsight = key => {
    setSelectedMetricPanel(null);
    setSelectedInsight(key);
  };

  const openMetricPanel = panel => {
    setSelectedInsight(null);
    setSelectedMetricPanel(panel);
  };


  /* =========================
     AUTH REDIRECTION
  ========================== */

  useEffect(() => {
    if (!loading && !authLoggedRef.current) {
      authLoggedRef.current = true;

      console.log(
        "[TimeLog] Auth resolved in",
        Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          mountTimeRef.current
        ),
        "ms"
      );
    }

    if (!loading && error === "ROLE_MISMATCH") {
      router.replace("/dashboard");
    }

    if (!loading && error === "USER_NOT_REGISTERED") {
      router.replace("/login");
    }
  }, [loading, error, router]);

  /* =========================
     DATA LOAD
  ========================== */

  useEffect(() => {
    if (!user) return;

    setDataLoading(true);
    setDashboardError("");

    const loaded = {
      leads: false,
      engagements: false,
      travelAgents: false
    };

    const markLoaded = key => {
      loaded[key] = true;

      if (
        loaded.leads &&
        loaded.engagements &&
        loaded.travelAgents
      ) {
        setDataLoading(false);

        console.log(
          "[TimeLog] Management dashboard ready in",
          Math.round(
            (typeof performance !== "undefined"
              ? performance.now()
              : Date.now()) - mountTimeRef.current
          ),
          "ms"
        );
      }
    };

    const handleError = (label, err) => {
      console.error(`${label} load failed:`, err);
      setDashboardError(`Unable to load ${label.toLowerCase()} data.`);
      setDataLoading(false);
    };

    const unsubLeads = onSnapshot(
      collection(db, LEADS_COLLECTION),
      snap => {
        const allRows = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        const activeRows = getActiveLeads(allRows).sort((a, b) => {
          const ad = getLeadDate(a)?.getTime() || 0;
          const bd = getLeadDate(b)?.getTime() || 0;
          return bd - ad;
        });

        console.log("[Management Dashboard Lead Filter]", {
          firestoreTotal: allRows.length,
          activeUsed: activeRows.length,
          deletedExcluded: allRows.length - activeRows.length,
          deletedLeadCodes: allRows
            .filter(isDeletedLead)
            .map(lead => lead.leadCode || lead.id)
        });

        setLeads(activeRows);
        markLoaded("leads");
      },
      err => handleError("Leads", err)
    );

    const unsubEngagements = onSnapshot(
      collection(db, ENGAGEMENT_COLLECTION),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const ad = getEngagementDate(a)?.getTime() || 0;
            const bd = getEngagementDate(b)?.getTime() || 0;
            return bd - ad;
          });

        setEngagements(rows);
        markLoaded("engagements");
      },
      err => handleError("Engagements", err)
    );

    const unsubTravelAgents = onSnapshot(
      collection(db, TRAVEL_AGENTS_COLLECTION),
      snap => {
        const rows = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setTravelAgents(rows);
        markLoaded("travelAgents");
      },
      err => handleError("Travel Agents", err)
    );


    return () => {
      unsubLeads();
      unsubEngagements();
      unsubTravelAgents();
    };
  }, [user]);

  /* =========================
     BASE MEMOS
  ========================== */

  const rangeWindow = useMemo(() => {
    return getAdminDateWindow(range, new Date(), scope.dateFrom, scope.dateTo);
  }, [range, scope.dateFrom, scope.dateTo]);

  const activeUsers = useMemo(() => {
    return teamDirectory.map(member => ({
      id: member.docId || member.key,
      uid: member.uid || member.key,
      email: member.email || "",
      name: member.name || "",
      displayName: member.name || "",
      department: member.team || "",
      teamName: member.team || "",
      role: member.role || "",
      active: true
    }));
  }, [teamDirectory]);

  const userMap = useMemo(() => {
    const map = new Map();

    allUserDirectory.forEach(member => {
      const normalizedUser = {
        id: member.docId || member.key,
        uid: member.uid || member.key,
        email: member.email || "",
        name: member.name || "",
        displayName: member.name || "",
        department: member.team || "",
        teamName: member.team || "",
        role: member.role || "",
        active: member.active !== false
      };

      [member.key, member.uid, member.docId, member.email, ...(member.aliases || []), ...(member.docIds || [])]
        .filter(Boolean)
        .forEach(value => {
          map.set(value, normalizedUser);
          map.set(normalize(value), normalizedUser);
        });
    });

    return map;
  }, [allUserDirectory]);

  const identityIsInSelectedTeam = identity => {
    if (!scope.team || scope.team === "all") return true;
    const resolved = resolveDirectoryIdentity(identity || {}, globalUserLookup);
    return !resolved.isUnmapped && teamMatchesScope(resolved.team, scope.team);
  };

  const activeDashboardLeads = useMemo(() => {
    return getActiveLeads(leads);
  }, [leads]);

  const teamScopedLeads = useMemo(() => {
    if (!scope.team || scope.team === "all") return activeDashboardLeads;
    return activeDashboardLeads.filter(lead => {
      const owner = getLeadOwner(lead);
      const assignee = getLeadAssignee(lead);
      return identityIsInSelectedTeam(owner) || identityIsInSelectedTeam(assignee);
    });
  }, [activeDashboardLeads, scope.team, globalUserLookup]);

  const periodLeads = useMemo(() => {
    return getActiveLeads(teamScopedLeads).filter(lead =>
      isInRange(getLeadDate(lead), rangeWindow)
    );
  }, [teamScopedLeads, rangeWindow]);

  const periodEngagements = useMemo(() => {
    return engagements.filter(item => {
      if (!isInRange(item.createdAt || item.updatedAt, rangeWindow)) return false;
      return identityIsInSelectedTeam(getEngagementOwner(item, userMap));
    });
  }, [engagements, rangeWindow, scope.team, globalUserLookup, userMap]);

  const periodTravelAgents = useMemo(() => {
    return travelAgents.filter(agent => {
      if (!isInRange(getTravelAgentDate(agent), rangeWindow)) return false;
      return identityIsInSelectedTeam(getTravelAgentCreator(agent));
    });
  }, [travelAgents, rangeWindow, scope.team, globalUserLookup]);

  const firstCallByNewAgent = useMemo(() => {
    const newAgentIds = new Set(periodTravelAgents.map(agent => agent.id).filter(Boolean));
    const firstCallMap = new Map();

    [...periodEngagements]
      .filter(item => {
        const agentId = getEngagementTravelAgentId(item);
        return normalize(item.channel) === "call" && newAgentIds.has(agentId);
      })
      .sort((a, b) => {
        const ad = getEngagementDate(a)?.getTime() || 0;
        const bd = getEngagementDate(b)?.getTime() || 0;
        return ad - bd;
      })
      .forEach(item => {
        const agentId = getEngagementTravelAgentId(item);
        if (agentId && !firstCallMap.has(agentId)) firstCallMap.set(agentId, item);
      });

    return firstCallMap;
  }, [periodEngagements, periodTravelAgents]);


  const convertedPeriodLeads = useMemo(() => {
    return getActiveLeads(teamScopedLeads).filter(lead => {
      return isWonLead(lead) && isInSelectedRangeByDate(getLeadWonDate(lead), rangeWindow);
    });
  }, [teamScopedLeads, rangeWindow]);

  const lostPeriodLeads = useMemo(() => {
    return getActiveLeads(teamScopedLeads).filter(lead => {
      return isLostLead(lead) && isInSelectedRangeByDate(getLeadLostDate(lead), rangeWindow);
    });
  }, [teamScopedLeads, rangeWindow]);


  const cancelledInvalidPeriodLeads = useMemo(() => {
    return getActiveLeads(teamScopedLeads).filter(lead => {
      return isCancelledInvalidLead(lead) && isInSelectedRangeByDate(getLeadCancelledInvalidDate(lead), rangeWindow);
    });
  }, [teamScopedLeads, rangeWindow]);

  const paymentReceivedPeriodLeads = useMemo(() => {
    return getActiveLeads(teamScopedLeads).filter(lead => {
      return getLeadReceivedAmount(lead) > 0 && isInSelectedRangeByDate(getPaymentDate(lead), rangeWindow);
    });
  }, [teamScopedLeads, rangeWindow]);

  const quoteValuePeriodLeads = useMemo(() => {
    return getActiveLeads(periodLeads).filter(lead => {
      return hasQuotationSent(lead) && getLeadQuotationAmount(lead) > 0;
    });
  }, [periodLeads]);

  /* =========================
     LEAD TOTALS
  ========================== */

  const leadTotals = useMemo(() => {
    const leadRows = getActiveLeads(periodLeads);

    const assignedLeads = leadRows.filter(hasLeadAssignee).length;
    const activeLeads = leadRows.filter(isActiveLead).length;

    const wonLeads = convertedPeriodLeads.length;
    const lostLeads = lostPeriodLeads.length;
    const cancelledInvalidLeads = cancelledInvalidPeriodLeads.length;
    const quoteSentLeads = quoteValuePeriodLeads.length;

    const uniqueAgents = new Set(
      leadRows
        .map(item => item.agentId || item.agentName || item.agencyName)
        .filter(Boolean)
    ).size;

    const uniqueDestinations = new Set(
      leadRows.map(item => item.destinationName).filter(Boolean)
    ).size;

    return {
      total: leadRows.length,
      activeLeads,
      assignedLeads,
      unassignedLeads: Math.max(leadRows.length - assignedLeads, 0),
      wonLeads,
      lostLeads,
      cancelledInvalidLeads,
      quoteSentLeads,
      uniqueAgents,
      uniqueDestinations,
      byStage: countBy(leadRows, item => item.stage || "Unknown"),
      byStatus: countBy(leadRows, item => item.status || "Unknown"),
      byDestination: countBy(
        leadRows,
        item => item.destinationName || "Unknown Destination"
      ),
      byOwner: countBy(leadRows, item => {
        const owner = getLeadOwner(item, userMap);
        return owner.name || "Legacy creator";
      }),
      byAssignee: countBy(leadRows, item => {
        const assignee = getLeadAssignee(item, userMap);
        return assignee.name || "Unassigned";
      }),
      bySource: countBy(leadRows, item => item.source || "Unknown Source"),
      byAgent: countBy(
        leadRows,
        item =>
          item.agentName ||
          item.agencyName ||
          item.travelAgentName ||
          "Unknown Agent"
      )
    };
  }, [
    periodLeads,
    userMap,
    convertedPeriodLeads,
    lostPeriodLeads,
    cancelledInvalidPeriodLeads,
    quoteValuePeriodLeads
  ]);

  /* =========================
     FINANCE TOTALS
  ========================== */

  const financeTotals = useMemo(() => {
    const financeLeads = getActiveLeads(periodLeads);
    const quotationValueLeads = getActiveLeads(quoteValuePeriodLeads);

    const quotationValue = quotationValueLeads.reduce((sum, lead) => {
      return sum + getLeadQuotationAmount(lead);
    }, 0);

    const vendorCost = financeLeads.reduce((sum, lead) => {
      return sum + getLeadVendorCost(lead);
    }, 0);

    const grossProfit = financeLeads.reduce((sum, lead) => {
      return sum + getLeadGrossProfit(lead);
    }, 0);

    const quotationGrossProfit = quotationValueLeads.reduce((sum, lead) => {
      return sum + getLeadGrossProfit(lead);
    }, 0);

    const realizedGrossProfit = financeLeads.reduce((sum, lead) => {
      return sum + getLeadActualRealizedGrossProfit(lead);
    }, 0);

    const unrealizedGrossProfit = financeLeads.reduce((sum, lead) => {
      return sum + getLeadUnrealizedGrossProfit(lead);
    }, 0);

    const realizedGrossProfitLeads = financeLeads.filter(lead => {
      return getLeadActualRealizedGrossProfit(lead) > 0;
    }).length;

    const unrealizedGrossProfitLeads = financeLeads.filter(lead => {
      return getLeadUnrealizedGrossProfit(lead) > 0;
    }).length;

    const receivableAmount = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.totalReceivableAmount);
    }, 0);

    const receivedAmount = financeLeads.reduce((sum, lead) => {
      return sum + getLeadReceivedAmount(lead);
    }, 0);

    const pendingReceivable = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.paymentBalance);
    }, 0);

    const vendorPayable = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.totalVendorPayableAmount);
    }, 0);

    const vendorPaid = financeLeads.reduce((sum, lead) => {
      return sum + getLeadVendorPaidAmount(lead);
    }, 0);

    const vendorBalance = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.vendorPaymentBalance);
    }, 0);

    // const quotationSent = financeLeads.filter(lead => {
    //   return normalize(lead?.latestQuotationStatus) === "sent";
    // }).length;

    const quotationSent = quotationValueLeads.length;

    const customerFullyPaid = financeLeads.filter(lead => {
      return normalize(lead?.customerPaymentStatus) === "fully_paid";
    }).length;

    const vendorFullyPaid = financeLeads.filter(lead => {
      return normalize(lead?.vendorPaymentStatus) === "fully_paid";
    }).length;

    const marginPercent = quotationValue
      ? Number(((quotationGrossProfit / quotationValue) * 100).toFixed(2))
      : 0;

    const lockedGrossProfit = convertedPeriodLeads.reduce((sum, lead) => {
      return sum + getLeadGrossProfit(lead);
    }, 0);

    const lockedQuotationValue = convertedPeriodLeads.reduce((sum, lead) => {
      return sum + getLeadQuotationAmount(lead);
    }, 0);

    const lockedVendorCost = convertedPeriodLeads.reduce((sum, lead) => {
      return sum + getLeadVendorCost(lead);
    }, 0);

    const lockedGrossProfitLeads = convertedPeriodLeads.length;



    const pipelineGrossProfit = financeLeads
      .filter(lead => isActiveLead(lead))
      .reduce((sum, lead) => {
        return sum + getLeadGrossProfit(lead);
      }, 0);

    return {
      quotationValue,
      vendorCost,
      grossProfit,
      realizedGrossProfit,
      unrealizedGrossProfit,
      realizedGrossProfitLeads,
      unrealizedGrossProfitLeads,
      receivableAmount,
      receivedAmount,
      pendingReceivable,
      vendorPayable,
      vendorPaid,
      vendorBalance,
      quotationSent,
      customerFullyPaid,
      vendorFullyPaid,
      marginPercent,
      lockedGrossProfit,
      lockedQuotationValue,
      lockedVendorCost,
      lockedGrossProfitLeads,
      quotationGrossProfit,
      pipelineGrossProfit,
      cashInHand: receivedAmount - vendorPaid,
      byDestinationRevenue: sumBy(
        financeLeads,
        lead => lead.destinationName || "Unknown Destination",
        getLeadQuotationAmount,
        formatCurrency
      ),
      byDestinationProfit: sumBy(
        financeLeads,
        lead => lead.destinationName || "Unknown Destination",
        getLeadGrossProfit,
        formatCurrency
      ),
      byAgentRevenue: sumBy(
        financeLeads,
        lead =>
          lead.agentName ||
          lead.agencyName ||
          lead.travelAgentName ||
          "Unknown Agent",
        getLeadQuotationAmount,
        formatCurrency
      ),
      byOwnerRevenue: sumBy(
        financeLeads,
        lead => {
          const owner = getLeadOwner(lead, userMap);
          return owner.name || "Legacy creator";
        },
        getLeadQuotationAmount,
        formatCurrency
      ),
      byAssigneeRevenue: sumBy(
        financeLeads,
        lead => {
          const assignee = getLeadAssignee(lead, userMap);
          return assignee.name || "Unassigned";
        },
        getLeadQuotationAmount,
        formatCurrency
      ),
      byPaymentStatus: countBy(
        financeLeads,
        lead => lead.customerPaymentStatus || "Not Updated"
      ),
      byVendorPaymentStatus: countBy(
        financeLeads,
        lead => lead.vendorPaymentStatus || "Not Updated"
      )
    };
  }, [periodLeads, userMap, convertedPeriodLeads, quoteValuePeriodLeads]);

  /* =========================
     VENDOR TOTALS
  ========================== */

  const vendorTotals = useMemo(() => {
    const vendorLeads = getActiveLeads(periodLeads);

    const requestedLeads = vendorLeads.filter(hasVendorRequest);
    const quoteReceivedLeads = vendorLeads.filter(hasVendorQuoteReceived);
    const pendingQuoteLeads = vendorLeads.filter(isVendorQuotePending);
    const selectedVendorLeads = vendorLeads.filter(isVendorSelected);

    const totalVendorRequests = vendorLeads.reduce((sum, lead) => {
      return sum + Number(lead?.vendorRequestCount || 0);
    }, 0);

    const totalVendorQuotes = vendorLeads.reduce((sum, lead) => {
      return sum + Number(lead?.vendorQuoteCount || 0);
    }, 0);

    const lastVendorActivity = vendorLeads.reduce((latest, lead) => {
      const d =
        toDate(lead?.lastVendorQuoteAt) ||
        toDate(lead?.lastVendorCommunicationAt);

      if (!d) return latest;
      if (!latest || d > latest) return d;

      return latest;
    }, null);

    return {
      requestedLeads: requestedLeads.length,
      quoteReceivedLeads: quoteReceivedLeads.length,
      pendingQuoteLeads: pendingQuoteLeads.length,
      selectedVendorLeads: selectedVendorLeads.length,
      totalVendorRequests,
      totalVendorQuotes,
      lastVendorActivity,
      byVendor: countBy(
        vendorLeads.filter(lead => lead?.latestVendorName),
        lead => lead.latestVendorName
      ),
      byVendorCost: sumBy(
        vendorLeads.filter(lead => lead?.latestVendorName),
        lead => lead.latestVendorName,
        getLeadVendorCost,
        formatCurrency
      ),
      byVendorStatus: countBy(
        vendorLeads.filter(hasVendorRequest),
        lead => lead.latestVendorRequestStatus || "Unknown"
      ),
      byVendorQuoteStatus: countBy(
        vendorLeads.filter(hasVendorRequest),
        lead => lead.latestVendorQuoteStatus || "Pending"
      )
    };
  }, [periodLeads]);

  /* =========================
     ATTENTION REQUIRED
  ========================== */

  const attentionSummary = useMemo(() => {
    const attentionLeads = getActiveLeads(periodLeads);

    const now = new Date();
    const staleLimit = new Date(now);
    staleLimit.setDate(staleLimit.getDate() - 3);

    const rows = [];

    const pushItem = (lead, type, severity, reason) => {
      if (isDeletedLead(lead)) return;

      rows.push({
        id: `${lead.id}-${type}`,
        leadId: lead.id,
        leadCode: lead.leadCode || lead.id,
        customerName: lead.customerName || lead.agentName || "Unknown Client",
        agentName:
          lead.agentName ||
          lead.agencyName ||
          lead.travelAgentName ||
          "Unknown Agent",
        destinationName: lead.destinationName || "Unknown Destination",
        assignedToName: lead.assignedToName || "Unassigned",
        stage: lead.stage || lead.status || "Unknown",
        type,
        severity,
        reason,
        amount: getLeadQuotationAmount(lead),
        lastActivityAt: getLeadActivityDate(lead)
      });
    };

    attentionLeads.forEach(lead => {
      if (!hasLeadAssignee(lead)) {
        pushItem(lead, "unassigned", "high", "Lead is not assigned to any team member.");
      }

      if (isActiveLead(lead) && !hasVendorRequest(lead)) {
        pushItem(lead, "vendor_request_missing", "medium", "Vendor request has not been sent.");
      }

      if (isVendorQuotePending(lead)) {
        pushItem(lead, "vendor_quote_pending", "high", "Vendor quotation is pending.");
      }

      if (hasVendorQuoteReceived(lead) && !hasQuotationSent(lead)) {
        pushItem(lead, "quotation_pending", "high", "Vendor quote received but quotation not sent to customer.");
      }

      if (toAmount(lead?.paymentBalance) > 0) {
        pushItem(lead, "customer_payment_pending", "high", "Customer payment balance is pending.");
      }

      if (toAmount(lead?.vendorPaymentBalance) > 0) {
        pushItem(lead, "vendor_payment_pending", "medium", "Vendor payment balance is pending.");
      }

      if (getLeadGrossProfit(lead) < 0) {
        pushItem(lead, "negative_profit", "critical", "Gross profit is negative.");
      }

      if (
        getLeadQuotationAmount(lead) > 0 &&
        Number(lead?.latestMarginPercent || 0) > 0 &&
        Number(lead?.latestMarginPercent || 0) < 8
      ) {
        pushItem(lead, "low_margin", "medium", "Margin is below recommended level.");
      }

      const nextDue = toDate(lead?.nextActionDueAt);
      if (isActiveLead(lead) && nextDue && nextDue < now) {
        pushItem(lead, "overdue_followup", "high", "Next action / follow-up is overdue.");
      }

      const lastActivity = getLeadActivityDate(lead);
      if (isActiveLead(lead) && lastActivity && lastActivity < staleLimit) {
        pushItem(lead, "stale_lead", "medium", "No recent activity in the last 3 days.");
      }
    });

    const byType = countBy(rows, item => item.type);
    const critical = rows.filter(item => item.severity === "critical").length;
    const high = rows.filter(item => item.severity === "high").length;
    const medium = rows.filter(item => item.severity === "medium").length;

    return {
      rows: rows.sort((a, b) => {
        const severityRank = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1
        };

        return (
          (severityRank[b.severity] || 0) -
          (severityRank[a.severity] || 0) ||
          (b.amount || 0) - (a.amount || 0)
        );
      }),
      byType,
      critical,
      high,
      medium,
      total: rows.length
    };
  }, [periodLeads]);

  /* =========================
     ENGAGEMENT TOTALS
  ========================== */

  const engagementTotals = useMemo(() => {
    const completed = periodEngagements.filter(
      item => normalize(item.status) === "completed"
    ).length;

    const byChannelRows = channel =>
      periodEngagements.filter(item => normalize(item.channel) === channel);

    const callRows = byChannelRows("call");
    const whatsappRows = byChannelRows("whatsapp");
    const emailRows = byChannelRows("email");
    const meetingRows = byChannelRows("meeting");
    const uniqueCalledAgentIds = new Set(
      callRows.map(getEngagementTravelAgentId).filter(Boolean)
    );
    const uniqueEngagedAgentIds = new Set(
      periodEngagements.map(getEngagementTravelAgentId).filter(Boolean)
    );

    const firstCallsCompleted = firstCallByNewAgent.size;
    const pendingFirstCalls = Math.max(periodTravelAgents.length - firstCallsCompleted, 0);

    const outcomeCount = code => {
      const ids = new Set();
      periodEngagements.forEach(item => {
        const outcome = normalize(item.outcomeCode || item.outcomeLabel || item.outcome);
        const agentId = getEngagementTravelAgentId(item);
        if (outcome === code && agentId) ids.add(agentId);
      });
      return ids.size;
    };

    const currentStatusCount = status =>
      periodTravelAgents.filter(agent =>
        normalizeTravelAgentStatus(agent.status || agent.agentStatus, agent.active) === status
      ).length;

    const lastActivity = periodEngagements.reduce((latest, item) => {
      const d = getEngagementDate(item);
      if (!d) return latest;
      if (!latest || d > latest) return d;
      return latest;
    }, null);

    return {
      total: periodEngagements.length,
      completed,
      calls: callRows.length,
      whatsapp: whatsappRows.length,
      emails: emailRows.length,
      meetings: meetingRows.length,
      newAgentsAdded: periodTravelAgents.length,
      firstCallsCompleted,
      // Backward-compatible alias used by a few overview components.
      newAgentCalls: firstCallsCompleted,
      pendingFirstCalls,
      newAgentContactRate: periodTravelAgents.length
        ? Math.round((firstCallsCompleted / periodTravelAgents.length) * 100)
        : 0,
      uniqueAgentsCalled: uniqueCalledAgentIds.size,
      uniqueAgentsContacted: uniqueEngagedAgentIds.size,
      invalidNumber: currentStatusCount("invalid_number") || outcomeCount("invalid_number"),
      businessShutDown: currentStatusCount("business_shut_down") || outcomeCount("business_shut_down"),
      wrongDetails: currentStatusCount("wrong_details") || outcomeCount("wrong_details"),
      doNotContact: currentStatusCount("do_not_contact") || outcomeCount("do_not_contact"),
      completionRate: periodEngagements.length
        ? Math.round((completed / periodEngagements.length) * 100)
        : 0,
      lastActivity,
      byChannel: countBy(periodEngagements, item => item.channel || "Unknown Channel"),
      byCreator: countBy(periodEngagements, item => {
        const owner = getEngagementOwner(item, userMap);
        return owner.name || "Legacy / Unmapped";
      }),
      byDestination: countBy(periodEngagements, getEngagementDestinationList)
    };
  }, [periodEngagements, periodTravelAgents, firstCallByNewAgent, userMap]);

  /* =========================
     USER TOTALS
  ========================== */

  const userTotals = useMemo(() => {
    const adminUsers = activeUsers.filter(item => {
      const role = normalize(item.role);
      return item.isAdmin === true || role === "admin" || role === "super_admin";
    }).length;

    const employeeUsers = activeUsers.filter(item => {
      const role = normalize(item.role);
      return role === "employee";
    }).length;

    return {
      activeUsers: activeUsers.length,
      adminUsers,
      employeeUsers,
      departments: new Set(
        activeUsers.map(item => item.department).filter(Boolean)
      ).size,
      byDepartment: countBy(
        activeUsers,
        item => item.department || "No Department"
      ),
      byRole: countBy(
        activeUsers,
        item => item.role || item.designation || "Unknown Role"
      )
    };
  }, [activeUsers]);

  /* =========================
     TEAM ROWS
  ========================== */

  const teamRows = useMemo(() => {
    const teamLeads = getActiveLeads(periodLeads);
    const map = new Map();

    const ensureMember = member => {
      const resolved = resolveDirectoryIdentity(
        {
          uid: member?.uid || "",
          email: member?.email || "",
          name: member?.name || ""
        },
        globalUserLookup
      );
      const canonical = resolved.isUnmapped
        ? member
        : {
            ...member,
            uid: resolved.uid || member?.uid || "",
            email: resolved.email || member?.email || "",
            name: resolved.name || member?.name || "",
            department: resolved.team || member?.department || "",
            role: resolved.role || member?.role || ""
          };
      const isLegacyUnmapped = canonical?.name === "Legacy / Unmapped";
      const key = isLegacyUnmapped
        ? "legacy-unmapped"
        : resolved.isUnmapped
          ? canonical?.uid || canonical?.email || canonical?.name || `unknown-${map.size + 1}`
          : resolved.key;

      if (!map.has(key)) {
        map.set(key, {
          uid: canonical?.uid || "",
          email: canonical?.email || "",
          name: canonical?.name || formatNameFromEmail(canonical?.email),
          department: canonical?.department || "",
          role: canonical?.role || "",

          // Lead ownership = permanent creator credit.
          newLeads: 0,
          ownedLeads: 0,
          activeLeads: 0,
          wonLeads: 0,
          lostLeads: 0,
          quoteSentLeads: 0,
          quotationValue: 0,
          receivedAmount: 0,
          vendorPaid: 0,
          grossProfit: 0,

          // Assignment = current working responsibility.
          assignedLeads: 0,
          assignedActiveLeads: 0,

          // Travel-agent acquisition and engagement.
          newAgentsAdded: 0,
          newAgentsCalled: 0,
          pendingFirstCalls: 0,
          acquisitionInvalidNumber: 0,
          acquisitionBusinessShutDown: 0,
          engagements: 0,
          completedEngagements: 0,
          calls: 0,
          firstCalls: 0,
          newAgentCalls: 0,
          whatsapp: 0,
          emails: 0,
          meetings: 0,
          otherEngagements: 0,
          invalidNumber: 0,
          businessShutDown: 0,
          wrongDetails: 0,
          doNotContact: 0,
          contactedAgentIds: new Set(),
          calledAgentIds: new Set(),
          invalidAgentIds: new Set(),
          businessShutAgentIds: new Set(),

          lastActivityAt: null,
          score: 0
        });
      }

      const row = map.get(key);
      if (!row.email && canonical?.email) row.email = canonical.email;
      if (!row.department && canonical?.department) row.department = canonical.department;
      if (!row.role && canonical?.role) row.role = canonical.role;
      return row;
    };

    const updateLastActivity = (row, value) => {
      const d = toDate(value);
      if (d && (!row.lastActivityAt || d > row.lastActivityAt)) row.lastActivityAt = d;
    };


    activeUsers.forEach(item => {
      ensureMember({
        uid: item.uid || item.id,
        email: item.email || "",
        name: item.displayName || item.name || formatNameFromEmail(item.email),
        department: item.department || "",
        role: item.role || item.designation || ""
      });
    });

    // Owner receives lead creation/conversion/value credit.
    teamLeads.forEach(lead => {
      const owner = getLeadOwner(lead, userMap);
      const ownerRow = ensureMember(owner);
      ownerRow.newLeads += 1;
      ownerRow.ownedLeads += 1;
      if (isActiveLead(lead)) ownerRow.activeLeads += 1;
      if (isWonLead(lead)) ownerRow.wonLeads += 1;
      if (isLostLead(lead)) ownerRow.lostLeads += 1;
      if (hasQuotationSent(lead)) ownerRow.quoteSentLeads += 1;
      ownerRow.quotationValue += getLeadQuotationAmount(lead);
      ownerRow.receivedAmount += getLeadReceivedAmount(lead);
      ownerRow.vendorPaid += getLeadVendorPaidAmount(lead);
      ownerRow.grossProfit += getLeadGrossProfit(lead);
      updateLastActivity(ownerRow, lead.lastActivityAt || lead.updatedAt || lead.createdAt);

      // Assignee receives workload only; reassignment never changes owner credit.
      if (hasLeadAssignee(lead)) {
        const assignee = getLeadAssignee(lead, userMap);
        const assigneeRow = ensureMember(assignee);
        assigneeRow.assignedLeads += 1;
        if (isActiveLead(lead)) assigneeRow.assignedActiveLeads += 1;
        updateLastActivity(assigneeRow, lead.lastActivityAt || lead.updatedAt || lead.assignedAt);
      }
    });

    // New travel-agent acquisition credit belongs to the creator of the master record.
    // Whether the record was contacted is tracked separately from who made the call.
    periodTravelAgents.forEach(agent => {
      const creator = getTravelAgentCreator(agent, userMap);
      const row = ensureMember(creator);
      const status = normalizeTravelAgentStatus(agent.status || agent.agentStatus, agent.active);

      row.newAgentsAdded += 1;
      if (firstCallByNewAgent.has(agent.id)) row.newAgentsCalled += 1;
      else row.pendingFirstCalls += 1;
      if (status === "invalid_number") row.acquisitionInvalidNumber += 1;
      if (status === "business_shut_down") row.acquisitionBusinessShutDown += 1;
      updateLastActivity(row, agent.updatedAt || agent.createdAt);
    });

    periodEngagements.forEach(item => {
      const owner = getEngagementOwner(item, userMap);
      const row = ensureMember(owner);
      const agentId = getEngagementTravelAgentId(item);
      const channel = normalize(item.channel);
      const outcome = normalize(item.outcomeCode || item.outcomeLabel || item.outcome);

      row.engagements += 1;
      if (normalize(item.status) === "completed") row.completedEngagements += 1;
      if (agentId) row.contactedAgentIds.add(agentId);

      if (channel === "call") {
        row.calls += 1;
        if (agentId) row.calledAgentIds.add(agentId);

        const firstCall = agentId ? firstCallByNewAgent.get(agentId) : null;
        if (firstCall && firstCall.id === item.id) {
          row.firstCalls += 1;
          row.newAgentCalls += 1;
        }
      } else if (channel === "whatsapp") row.whatsapp += 1;
      else if (channel === "email") row.emails += 1;
      else if (channel === "meeting") row.meetings += 1;
      else row.otherEngagements += 1;

      if (outcome === "invalid_number" && agentId) row.invalidAgentIds.add(agentId);
      else if (outcome === "business_shut_down" && agentId) row.businessShutAgentIds.add(agentId);
      else if (outcome === "wrong_details") row.wrongDetails += 1;
      else if (outcome === "do_not_contact") row.doNotContact += 1;

      updateLastActivity(row, item.updatedAt || item.createdAt);
    });


    return Array.from(map.values())
      .map(row => {
        const profitScore = Math.max(Math.floor(row.grossProfit / 1000), 0);
        const score =
          row.wonLeads * 15 +
          row.quoteSentLeads * 5 +
          row.completedEngagements * 3 +
          row.calls * 2 +
          row.meetings * 3 +
          row.newAgentsAdded * 2 +
          row.firstCalls * 2 +
          row.activeLeads +
          profitScore -
          row.lostLeads * 5;

        return {
          ...row,
          uniqueAgentsContacted: row.contactedAgentIds.size,
          uniqueAgentsCalled: row.calledAgentIds.size,
          followUpCalls: Math.max(row.calls - row.firstCalls, 0),
          invalidNumber: row.invalidAgentIds.size,
          businessShutDown: row.businessShutAgentIds.size,
          acquisitionContactRate: row.newAgentsAdded
            ? Math.round((row.newAgentsCalled / row.newAgentsAdded) * 100)
            : 0,
          contactedAgentIds: undefined,
          calledAgentIds: undefined,
          invalidAgentIds: undefined,
          businessShutAgentIds: undefined,
          score
        };
      })
      .sort((a, b) => {
        if (activeTab === "engagement") {
          return b.firstCalls - a.firstCalls || b.calls - a.calls || b.engagements - a.engagements;
        }
        if (activeTab === "leads") {
          return b.ownedLeads - a.ownedLeads || b.assignedActiveLeads - a.assignedActiveLeads;
        }
        if (activeTab === "finance") {
          return b.grossProfit - a.grossProfit || b.quotationValue - a.quotationValue;
        }
        return b.score - a.score;
      });
  }, [
    activeUsers,
    periodLeads,
    periodEngagements,
    periodTravelAgents,
    firstCallByNewAgent,
    userMap,
    globalUserLookup,
    activeTab
  ]);


  const insightPanels = useMemo(() => {
    const activeLeadRows = periodLeads.filter(isActiveLead);

    // const quotationRows = quotationPeriodLeads.filter(
    //   lead => getLeadQuotationAmount(lead) > 0
    // );

    const quotationRows = quoteValuePeriodLeads;

    const grossProfitRows = convertedPeriodLeads.filter(
      lead => getLeadGrossProfit(lead) !== 0
    );

    const pendingReceivableRows = periodLeads.filter(
      lead => toAmount(lead?.paymentBalance) > 0
    );

    const vendorBalanceRows = periodLeads.filter(
      lead => toAmount(lead?.vendorPaymentBalance) > 0
    );

    return {
      activeLeads: {
        title: "Active Leads",
        description: `${getRangeLabel(range)} active pipeline leads.`,
        rows: activeLeadRows,
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      convertedLeads: {
        title: "Converted Leads",
        description: "Leads converted during the selected period.",
        rows: convertedPeriodLeads,
        type: "lead",
        amountLabel: "Gross Profit",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadWonDate
      },

      quotationValue: {
        title: "Quotation Value",
        description: "Quotation-sent leads during the selected period.",
        rows: quotationRows,
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount,
        dateGetter: getQuotationDate
      },

      vendorPaid: {
        title: "Vendor Paid",
        description: "Vendor payment already paid for selected leads.",
        rows: periodLeads.filter(lead => getLeadVendorPaidAmount(lead) > 0),
        type: "lead",
        amountLabel: "Vendor Paid",
        amountGetter: getLeadVendorPaidAmount
      },

      cashPosition: {
        title: "Net Cash Position",
        description: "Travel agent received amount minus vendor paid amount.",
        rows: periodLeads.filter(lead => {
          return getLeadReceivedAmount(lead) > 0 || getLeadVendorPaidAmount(lead) > 0;
        }),
        type: "lead",
        amountLabel: "Net Cash",
        amountGetter: lead => getLeadReceivedAmount(lead) - getLeadVendorPaidAmount(lead)
      },

      grossProfit: {
        title: "Gross Profit",
        description: "Total gross profit from selected leads.",
        rows: periodLeads.filter(lead => getLeadGrossProfit(lead) !== 0),
        type: "lead",
        amountLabel: "Gross Profit",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadDate,
        showGrossProfitBreakdown: true,
        summaryCards: [
          {
            label: "Total Gross Profit",
            value: formatCurrency(financeTotals.grossProfit),
            tone: "emerald"
          },
          {
            label: "Actual Realized",
            value: formatCurrency(financeTotals.realizedGrossProfit),
            tone: "green"
          },
          {
            label: "Not Realized",
            value: formatCurrency(financeTotals.unrealizedGrossProfit),
            tone: "amber"
          }
        ]
      },

      lockedGrossProfit: {
        title: "Locked Gross Profit",
        description: "Gross profit locked after leads are marked as Deal Won / Converted / Closed Won.",
        rows: convertedPeriodLeads,
        type: "lead",
        amountLabel: "Locked GP",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadWonDate,
        summaryCards: [
          {
            label: "Locked GP",
            value: formatCurrency(financeTotals.lockedGrossProfit),
            tone: "green"
          },
          {
            label: "Locked Quotation",
            value: formatCurrency(financeTotals.lockedQuotationValue),
            tone: "emerald"
          },
          {
            label: "Locked Vendor Cost",
            value: formatCurrency(financeTotals.lockedVendorCost),
            tone: "amber"
          }
        ]
      },

      customerReceived: {
        title: "Customer Received",
        description: "Leads with customer payment received in selected period.",
        rows: paymentReceivedPeriodLeads,
        type: "lead",
        amountLabel: "Received",
        amountGetter: getLeadReceivedAmount,
        dateGetter: getPaymentDate
      },

      pendingReceivable: {
        title: "Pending Receivable",
        description: "Leads where customer payment balance is pending.",
        rows: pendingReceivableRows,
        type: "lead",
        amountLabel: "Pending",
        amountGetter: lead => toAmount(lead?.paymentBalance)
      },

      vendorBalance: {
        title: "Vendor Balance",
        description: "Leads where vendor payout balance is pending.",
        rows: vendorBalanceRows,
        type: "lead",
        amountLabel: "Vendor Balance",
        amountGetter: lead => toAmount(lead?.vendorPaymentBalance)
      },

      attentionItems: {
        title: "Attention Items",
        description: "Issues that need management or operations action.",
        rows: attentionSummary.rows,
        type: "attention"
      }
    };
  }, [
    periodLeads,
    quoteValuePeriodLeads,
    convertedPeriodLeads,
    paymentReceivedPeriodLeads,
    attentionSummary.rows,
    financeTotals,
    range
  ]);

  const openLeadMetricDetail = (lead, metricKey) => {
    if (!lead) return;

    const metricMap = {
      vendorRequests: {
        title: `${lead.leadCode || "Lead"} - Vendor Requests`,
        description: "Vendor request count for this lead.",
        rows: [lead],
        type: "lead",
        amountLabel: "Vendor Requests",
        amountGetter: item => Number(item.vendorRequestCount || 0),
        amountFormatter: value => Number(value || 0)
      },

      vendorQuotes: {
        title: `${lead.leadCode || "Lead"} - Vendor Quotes`,
        description: "Vendor quote count for this lead.",
        rows: [lead],
        type: "lead",
        amountLabel: "Vendor Quotes",
        amountGetter: item => Number(item.vendorQuoteCount || 0),
        amountFormatter: value => Number(value || 0)
      },

      vendorCost: {
        title: `${lead.leadCode || "Lead"} - Vendor Cost`,
        description: "Vendor cost for this lead.",
        rows: [lead],
        type: "lead",
        amountLabel: "Vendor Cost",
        amountGetter: getLeadVendorCost
      },

      vendorPaid: {
        title: `${lead.leadCode || "Lead"} - Vendor Paid`,
        description: "Vendor paid amount for this lead.",
        rows: [lead],
        type: "lead",
        amountLabel: "Vendor Paid",
        amountGetter: getLeadVendorPaidAmount
      },

      vendorBalance: {
        title: `${lead.leadCode || "Lead"} - Vendor Balance`,
        description: "Pending vendor payment balance for this lead.",
        rows: [lead],
        type: "lead",
        amountLabel: "Vendor Balance",
        amountGetter: getLeadVendorPaymentBalance
      }
    };

    const panel = metricMap[metricKey];

    if (!panel) return;

    openMetricPanel(panel);
  };

  const openTeamMetricDetail = (teamRow, metricKey) => {
    const leadRows = getActiveLeads(periodLeads);
    const engagementRows = periodEngagements;

    const createdLeadRows = leadRows.filter(lead => {
      return isSameDashboardMember(teamRow, getLeadCreator(lead, userMap));
    });

    const ownedLeadRows = leadRows.filter(lead => {
      return isSameDashboardMember(teamRow, getLeadOwner(lead, userMap));
    });

    const assignedLeadRows = leadRows.filter(lead => {
      return isSameDashboardMember(teamRow, getLeadAssignee(lead, userMap));
    });

    const ownedEngagementRows = engagementRows.filter(item => {
      return isSameDashboardMember(teamRow, getEngagementOwner(item, userMap));
    });


    const metricMap = {
      newLeads: {
        title: `${teamRow.name} - New Leads`,
        description: "Leads created by this team member.",
        rows: createdLeadRows,
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      assignedLeads: {
        title: `${teamRow.name} - Assigned Workload`,
        description: "Leads currently assigned to this team member. Ownership remains with the creator.",
        rows: assignedLeadRows,
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      assignedActiveLeads: {
        title: `${teamRow.name} - Active Assigned Workload`,
        description: "Open leads currently assigned to this team member.",
        rows: assignedLeadRows.filter(isActiveLead),
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      activeLeads: {
        title: `${teamRow.name} - Active Leads`,
        description: "Active leads owned by this team member.",
        rows: ownedLeadRows.filter(isActiveLead),
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      quoteSentLeads: {
        title: `${teamRow.name} - Quote Sent Leads`,
        description: "Leads where quotation has been sent.",
        rows: ownedLeadRows.filter(hasQuotationSent),
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      wonLeads: {
        title: `${teamRow.name} - Won Leads`,
        description: "Converted / deal won leads.",
        rows: ownedLeadRows.filter(isWonLead),
        type: "lead",
        amountLabel: "Gross Profit",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadWonDate
      },

      lostLeads: {
        title: `${teamRow.name} - Lost Leads`,
        description: "Lost / cancelled leads.",
        rows: ownedLeadRows.filter(isLostLead),
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount,
        dateGetter: getLeadLostDate
      },

      quotationValue: {
        title: `${teamRow.name} - Quotation Value`,
        description: "Quotation value from leads owned by this team member.",
        rows: ownedLeadRows.filter(lead => getLeadQuotationAmount(lead) > 0),
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      receivedAmount: {
        title: `${teamRow.name} - Customer Received`,
        description: "Customer / travel agent received amount.",
        rows: ownedLeadRows.filter(lead => getLeadReceivedAmount(lead) > 0),
        type: "lead",
        amountLabel: "Received",
        amountGetter: getLeadReceivedAmount
      },

      vendorPaid: {
        title: `${teamRow.name} - Vendor Paid`,
        description: "Vendor payment already paid.",
        rows: ownedLeadRows.filter(lead => getLeadVendorPaidAmount(lead) > 0),
        type: "lead",
        amountLabel: "Vendor Paid",
        amountGetter: getLeadVendorPaidAmount
      },

      grossProfit: {
        title: `${teamRow.name} - Gross Profit`,
        description: "Gross profit from owned leads.",
        rows: ownedLeadRows.filter(lead => getLeadGrossProfit(lead) !== 0),
        type: "lead",
        amountLabel: "Gross Profit",
        amountGetter: getLeadGrossProfit,
        showGrossProfitBreakdown: true
      },

      engagements: {
        title: `${teamRow.name} - Engagements`,
        description: "All engagements done by this team member.",
        rows: ownedEngagementRows,
        type: "engagement"
      },

      newAgentCalls: {
        title: `${teamRow.name} - First Calls`,
        description: "First call to each new travel agent. Each new agent can contribute only one first-call credit.",
        rows: ownedEngagementRows.filter(item => {
          const agentId = getEngagementTravelAgentId(item);
          const firstCall = agentId ? firstCallByNewAgent.get(agentId) : null;
          return firstCall?.id === item.id;
        }),
        type: "engagement"
      },

      invalidNumber: {
        title: `${teamRow.name} - Invalid Number Outcomes`,
        description: "Engagements marked with an invalid phone number.",
        rows: ownedEngagementRows.filter(item => normalize(item.outcomeCode || item.outcomeLabel || item.outcome) === "invalid_number"),
        type: "engagement"
      },

      businessShutDown: {
        title: `${teamRow.name} - Business Shut Down Outcomes`,
        description: "Engagements where the travel-agent business was marked shut down.",
        rows: ownedEngagementRows.filter(item => normalize(item.outcomeCode || item.outcomeLabel || item.outcome) === "business_shut_down"),
        type: "engagement"
      },

      calls: {
        title: `${teamRow.name} - Calls`,
        description: "Call engagements.",
        rows: ownedEngagementRows.filter(item => normalize(item.channel) === "call"),
        type: "engagement"
      },

      whatsapp: {
        title: `${teamRow.name} - WhatsApp`,
        description: "WhatsApp engagements.",
        rows: ownedEngagementRows.filter(item => normalize(item.channel) === "whatsapp"),
        type: "engagement"
      },

      emails: {
        title: `${teamRow.name} - Emails`,
        description: "Email engagements.",
        rows: ownedEngagementRows.filter(item => normalize(item.channel) === "email"),
        type: "engagement"
      },

      meetings: {
        title: `${teamRow.name} - Meetings`,
        description: "Meeting engagements.",
        rows: ownedEngagementRows.filter(item => normalize(item.channel) === "meeting"),
        type: "engagement"
      },

      completedEngagements: {
        title: `${teamRow.name} - Completed Engagements`,
        description: "Completed engagement activities.",
        rows: ownedEngagementRows.filter(item => normalize(item.status) === "completed"),
        type: "engagement"
      }
    };

    const panel = metricMap[metricKey];

    if (!panel) return;

    openMetricPanel(panel);
  };

  const selectedInsightPanel = selectedMetricPanel || (
    selectedInsight ? insightPanels[selectedInsight] : null
  );

  /* =========================
     RENDER GUARDS
  ========================== */

  if (loading || user === undefined) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "finance", label: "Finance", icon: CircleDollarSign },
    { key: "leads", label: "Pipeline", icon: LineChart },
    { key: "vendor", label: "Vendors", icon: Handshake },
    { key: "attention", label: "Attention", icon: AlertTriangle },
    { key: "engagement", label: "Engagement", icon: Activity },
    { key: "team", label: "Team", icon: Users }
  ];

  function HighValueAttentionLeads({ rows = [] }) {
    const uniqueRows = getUniqueHighValueAttentionRows(rows).slice(0, 8);
    const max = uniqueRows.length
      ? Math.max(...uniqueRows.map(row => row.count))
      : 0;

    const theme = KPI_TONES.orange;

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-xl p-2 ${theme.icon}`}>
            <CircleDollarSign className="h-4 w-4" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              High Value Attention Leads
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Unique leads ranked by quotation value.
            </p>
          </div>
        </div>

        {!uniqueRows.length ? (
          <p className="text-sm text-gray-500 mt-4">
            No high value attention leads found.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {uniqueRows.map(row => {
              const width = max
                ? `${Math.max((row.count / max) * 100, 8)}%`
                : "0%";

              return (
                <div key={`high-value-attention-${row.key || row.name}`}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {row.name}
                      </p>

                      <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                        {row.subLabel}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {row.displayCount}
                    </p>
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${theme.icon}`}
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}

            {getUniqueHighValueAttentionRows(rows).length > 8 && (
              <p className="text-xs text-gray-400">
                Showing top 8 of {getUniqueHighValueAttentionRows(rows).length}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (dataLoading || usersLoading) {
    return (
      <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        <DashboardSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <BarChart3 className="h-3.5 w-3.5" />
              Management Command Center
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-950">
              Management Dashboard
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              Executive overview of active leads, finance, vendor operations, team workload and travel-agent engagement.
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            Global Date + Team scope applies to this dashboard
          </div>
        </div>

        {dashboardError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dashboardError}
          </div>
        ) : null}


        <BusinessPulseCard
          range={range}
          financeTotals={financeTotals}
          leadTotals={leadTotals}
          vendorTotals={vendorTotals}
          attentionSummary={attentionSummary}
          onOpenDetail={openInsight}
        />

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <ExecutiveKpiCard
            title="Active Leads"
            value={leadTotals.activeLeads}
            helper={`${leadTotals.quoteSentLeads} quotations sent`}
            icon={LineChart}
            tone="blue"
            onClick={() => openInsight("activeLeads")}
          />

          <ExecutiveKpiCard
            title="Converted Leads"
            value={leadTotals.wonLeads}
            helper={`${leadTotals.lostLeads} lost • ${leadTotals.cancelledInvalidLeads} cancelled / invalid`}
            icon={CheckCircle2}
            tone="green"
            onClick={() => openInsight("convertedLeads")}
          />

          <ExecutiveKpiCard
            title="Quotation Value"
            value={formatCurrency(financeTotals.quotationValue)}
            helper={`Margin ${financeTotals.marginPercent}%`}
            icon={IndianRupee}
            tone="purple"
            onClick={() => openInsight("quotationValue")}
          />

          <ExecutiveKpiCard
            title="Gross Profit"
            value={formatCurrency(financeTotals.grossProfit)}
            helper={`${formatCurrency(financeTotals.pipelineGrossProfit)} pipeline GP`}
            icon={TrendingUp}
            tone="emerald"
            onClick={() => openInsight("grossProfit")}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <ExecutiveKpiCard
            title="Locked GP"
            value={formatCurrency(financeTotals.lockedGrossProfit)}
            helper={`${financeTotals.lockedGrossProfitLeads} converted leads • ${formatCurrency(financeTotals.lockedVendorCost)} vendor cost`}
            icon={CheckCircle2}
            tone="green"
            onClick={() => openInsight("lockedGrossProfit")}
          />

          <ExecutiveKpiCard
            title="Travel Agent Received"
            value={formatCurrency(financeTotals.receivedAmount)}
            helper={`${financeTotals.customerFullyPaid} fully paid leads`}
            icon={Wallet}
            tone="green"
            onClick={() => openInsight("customerReceived")}
          />

          <ExecutiveKpiCard
            title="Pending TA Collection"
            value={formatCurrency(financeTotals.pendingReceivable)}
            helper={financeTotals.pendingReceivable ? "Follow-up required" : "No collection pending"}
            icon={CreditCard}
            tone={financeTotals.pendingReceivable ? "amber" : "slate"}
            onClick={() => openInsight("pendingReceivable")}
          />

          <ExecutiveKpiCard
            title="Attention Items"
            value={attentionSummary.total}
            helper={`${attentionSummary.critical} critical • ${attentionSummary.high} high`}
            icon={AlertTriangle}
            tone={attentionSummary.total ? "red" : "slate"}
            onClick={() => openInsight("attentionItems")}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <DashboardGraphCard
            title="Finance Health"
            description="Receivable, received, vendor payout and profit view."
            icon={CircleDollarSign}
            tone="purple"
          >
            <MiniColumnGraph
              rows={[
                {
                  label: "Quotation",
                  value: financeTotals.quotationValue,
                  display: formatCurrency(financeTotals.quotationValue),
                  tone: "purple"
                },
                {
                  label: "Received",
                  value: financeTotals.receivedAmount,
                  display: formatCurrency(financeTotals.receivedAmount),
                  tone: "green"
                },
                {
                  label: "Vendor Paid",
                  value: financeTotals.vendorPaid,
                  display: formatCurrency(financeTotals.vendorPaid),
                  tone: "blue"
                },
                {
                  label: "Gross Profit",
                  value: financeTotals.grossProfit,
                  display: formatCurrency(financeTotals.grossProfit),
                  tone: "emerald"
                }
              ]}
            />
          </DashboardGraphCard>

          <DashboardGraphCard
            title="Pipeline Health"
            description="Lead movement across assignment, quote and conversion."
            icon={Layers3}
            tone="blue"
          >
            <MiniColumnGraph
              rows={[
                {
                  label: "Total",
                  value: leadTotals.total,
                  display: leadTotals.total,
                  tone: "slate"
                },
                {
                  label: "Assigned",
                  value: leadTotals.assignedLeads,
                  display: leadTotals.assignedLeads,
                  tone: "blue"
                },
                {
                  label: "Quote Sent",
                  value: leadTotals.quoteSentLeads,
                  display: leadTotals.quoteSentLeads,
                  tone: "purple"
                },
                {
                  label: "Converted",
                  value: leadTotals.wonLeads,
                  display: leadTotals.wonLeads,
                  tone: "green"
                }
              ]}
            />
          </DashboardGraphCard>

          <DashboardGraphCard
            title="Risk Signals"
            description="Items needing team or management attention."
            icon={AlertTriangle}
            tone={attentionSummary.total ? "red" : "green"}
          >
            <MiniColumnGraph
              rows={[
                {
                  label: "Critical",
                  value: attentionSummary.critical,
                  display: attentionSummary.critical,
                  tone: "red"
                },
                {
                  label: "High",
                  value: attentionSummary.high,
                  display: attentionSummary.high,
                  tone: "orange"
                },
                {
                  label: "Medium",
                  value: attentionSummary.medium,
                  display: attentionSummary.medium,
                  tone: "amber"
                },
                {
                  label: "Vendor",
                  value: vendorTotals.pendingQuoteLeads,
                  display: vendorTotals.pendingQuoteLeads,
                  tone: "purple"
                }
              ]}
            />
          </DashboardGraphCard>
        </section>

        <div className="sticky top-20 z-30 bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-1  flex gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
                  ${activeTab === tab.key
                    ? "bg-gray-900 text-white "
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "overview" && (
        <section className="space-y-6">
          <SectionHeader
            icon={LayoutDashboard}
            title="Executive Overview"
            description={`Showing ${getRangeLabel(range)} performance across leads, finance, vendors and team.`}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Total Leads" value={leadTotals.total} />
            <DashboardKpiCard label="Quote Sent" value={leadTotals.quoteSentLeads} color="blue" />
            <DashboardKpiCard label="Margin" value={`${financeTotals.marginPercent}%`} color="purple" />
            <DashboardKpiCard label="First Calls" value={engagementTotals.firstCallsCompleted} color="green" />
          </div>

          <InsightCards
            financeTotals={financeTotals}
            attentionSummary={attentionSummary}
          />

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartShell
              icon={LineChart}
              tone="blue"
              title="Lead Trend"
              description="Lead inflow trend for selected period."
            >
              <LeadsTrendChart leads={teamScopedLeads} days={14} />
            </ChartShell>

            <ChartShell
              icon={PieChart}
              tone="purple"
              title="Leads by Stage"
              description="Current lead distribution by pipeline stage."
            >
              <LeadsByStageChart leads={periodLeads} />
            </ChartShell>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={TrendingUp}
              tone="green"
              title="Revenue by Destination"
              rows={financeTotals.byDestinationRevenue}
            />
            <MiniBarList
              icon={Target}
              tone="emerald"
              title="Gross Profit by Destination"
              rows={financeTotals.byDestinationProfit}
            />
            <MiniBarList
              icon={BriefcaseBusiness}
              tone="blue"
              title="Top Travel Agents"
              rows={leadTotals.byAgent}
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={Handshake}
              tone="purple"
              title="Vendor Requests by Status"
              rows={vendorTotals.byVendorStatus}
            />
            <MiniBarList
              icon={CheckCircle2}
              tone="green"
              title="Vendor Quotes by Status"
              rows={vendorTotals.byVendorQuoteStatus}
            />
            <MiniBarList
              icon={AlertTriangle}
              tone="red"
              title="Attention by Type"
              rows={attentionSummary.byType}
            />
          </section>

          <AttentionRequiredPanel
            rows={attentionSummary.rows.slice(0, 8)}
            compact
            onViewLead={leadId => router.push(`/admin/leads/${leadId}`)}
          />

          <ManagementOverviewTable rows={teamRows} onOpenMetric={openTeamMetricDetail} />
        </section>
      )}

      {activeTab === "finance" && (
        <section className="space-y-6">
          <SectionHeader
            icon={CircleDollarSign}
            title="Finance Performance"
            description="Quotation value, receivables, vendor payout and gross profit view."
          />

          <FinanceFlowCard financeTotals={financeTotals} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Quotation Value" value={formatCurrency(financeTotals.quotationValue)} color="purple" />
            <DashboardKpiCard label="Total Receivable" value={formatCurrency(financeTotals.receivableAmount)} color="blue" />
            <DashboardKpiCard label="Customer Received" value={formatCurrency(financeTotals.receivedAmount)} color="green" />
            <DashboardKpiCard label="Pending Receivable" value={formatCurrency(financeTotals.pendingReceivable)} color={financeTotals.pendingReceivable ? "amber" : "gray"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Vendor Payable" value={formatCurrency(financeTotals.vendorPayable)} color="blue" />
            <DashboardKpiCard label="Vendor Paid" value={formatCurrency(financeTotals.vendorPaid)} color="green" />
            <DashboardKpiCard label="Vendor Balance" value={formatCurrency(financeTotals.vendorBalance)} color={financeTotals.vendorBalance ? "amber" : "gray"} />
            <DashboardKpiCard label="Margin" value={`${financeTotals.marginPercent}%`} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={TrendingUp}
              tone="green"
              title="Revenue by Destination"
              rows={financeTotals.byDestinationRevenue}
            />
            <MiniBarList
              icon={Target}
              tone="emerald"
              title="Gross Profit by Destination"
              rows={financeTotals.byDestinationProfit}
            />
            <MiniBarList
              icon={BriefcaseBusiness}
              tone="blue"
              title="Revenue by Travel Agent"
              rows={financeTotals.byAgentRevenue}
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={Users}
              tone="purple"
              title="Revenue by Lead Owner"
              rows={financeTotals.byOwnerRevenue}
            />
            <MiniBarList
              icon={Wallet}
              tone="green"
              title="Customer Payment Status"
              rows={financeTotals.byPaymentStatus}
            />
            <MiniBarList
              icon={Handshake}
              tone="orange"
              title="Vendor Payment Status"
              rows={financeTotals.byVendorPaymentStatus}
            />
          </section>

          <ManagementFinanceTable rows={teamRows}
            onOpenMetric={openTeamMetricDetail} />
        </section>
      )}

      {activeTab === "leads" && (
        <section className="space-y-6">
          <SectionHeader
            icon={LineChart}
            title="Lead Pipeline"
            description="Lead movement, assignment, conversion and destination performance."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="New Leads" value={leadTotals.total} />
            <DashboardKpiCard label="Active Leads" value={leadTotals.activeLeads} color="blue" />
            <DashboardKpiCard label="Quote Sent" value={leadTotals.quoteSentLeads} color="purple" />
            <DashboardKpiCard label="Converted" value={leadTotals.wonLeads} color="green" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <DashboardKpiCard label="Assigned" value={leadTotals.assignedLeads} color="blue" />
            <DashboardKpiCard label="Unassigned" value={leadTotals.unassignedLeads} color={leadTotals.unassignedLeads ? "red" : "gray"} />
            <DashboardKpiCard label="Lost" value={leadTotals.lostLeads} color={leadTotals.lostLeads ? "red" : "gray"} />
            <DashboardKpiCard label="Cancelled / Invalid" value={leadTotals.cancelledInvalidLeads} color={leadTotals.cancelledInvalidLeads ? "gray" : "gray"} />
            <DashboardKpiCard label="Destinations" value={leadTotals.uniqueDestinations} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartShell
              icon={PieChart}
              tone="purple"
              title="Leads by Stage"
              description="Lead distribution across pipeline stages."
            >
              <LeadsByStageChart leads={periodLeads} />
            </ChartShell>

            <ChartShell
              icon={Target}
              tone="blue"
              title="Leads by Destination"
              description="Destination-wise lead distribution."
            >
              <LeadsByDestinationChart leads={periodLeads} />
            </ChartShell>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList icon={PieChart} tone="purple" title="Leads by Stage" rows={leadTotals.byStage} />
            <MiniBarList icon={BarChart3} tone="blue" title="Leads by Status" rows={leadTotals.byStatus} />
            <MiniBarList icon={Activity} tone="green" title="Leads by Source" rows={leadTotals.bySource} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={UserCheck} tone="blue" title="Leads by Owner (Creator Credit)" rows={leadTotals.byOwner} />
            <MiniBarList icon={Users} tone="purple" title="Leads by Current Assignee (Workload)" rows={leadTotals.byAssignee} />
          </section>

          <ManagementLeadsTable rows={teamRows} onOpenMetric={openTeamMetricDetail} />
        </section>
      )}

      {activeTab === "vendor" && (
        <section className="space-y-6">
          <SectionHeader
            icon={Handshake}
            title="Vendor Operations"
            description="Vendor requests, received quotes, pending quotes and vendor payment exposure."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Vendor Requests" value={vendorTotals.totalVendorRequests} color="blue" />
            <DashboardKpiCard label="Vendor Quotes" value={vendorTotals.totalVendorQuotes} color="green" />
            <DashboardKpiCard label="Pending Quotes" value={vendorTotals.pendingQuoteLeads} color={vendorTotals.pendingQuoteLeads ? "amber" : "gray"} />
            <DashboardKpiCard label="Vendors Selected" value={vendorTotals.selectedVendorLeads} color="purple" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Vendor Cost" value={formatCurrency(financeTotals.vendorCost)} color="blue" />
            <DashboardKpiCard label="Vendor Paid" value={formatCurrency(financeTotals.vendorPaid)} color="green" />
            <DashboardKpiCard label="Vendor Balance" value={formatCurrency(financeTotals.vendorBalance)} color={financeTotals.vendorBalance ? "amber" : "gray"} />
            <DashboardKpiCard label="Last Vendor Activity" value={formatDateTime(vendorTotals.lastVendorActivity)} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList icon={Handshake} tone="blue" title="Vendor Requests by Status" rows={vendorTotals.byVendorStatus} />
            <MiniBarList icon={CheckCircle2} tone="green" title="Vendor Quotes by Status" rows={vendorTotals.byVendorQuoteStatus} />
            <MiniBarList icon={Users} tone="purple" title="Top Vendors by Count" rows={vendorTotals.byVendor} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={CircleDollarSign} tone="orange" title="Top Vendors by Cost" rows={vendorTotals.byVendorCost} />
            <MiniBarList icon={Wallet} tone="green" title="Vendor Payment Status" rows={financeTotals.byVendorPaymentStatus} />
          </section>

          <ManagementVendorTable rows={periodLeads} onOpenLeadMetric={openLeadMetricDetail} />
        </section>
      )}

      {activeTab === "attention" && (
        <section className="space-y-6">
          <SectionHeader
            icon={AlertTriangle}
            title="Attention Required"
            description="Issues that need management or operations action."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Total Attention Items" value={attentionSummary.total} color={attentionSummary.total ? "red" : "gray"} />
            <DashboardKpiCard label="Critical" value={attentionSummary.critical} color={attentionSummary.critical ? "red" : "gray"} />
            <DashboardKpiCard label="High Priority" value={attentionSummary.high} color={attentionSummary.high ? "amber" : "gray"} />
            <DashboardKpiCard label="Medium Priority" value={attentionSummary.medium} color={attentionSummary.medium ? "blue" : "gray"} />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={AlertTriangle} tone="red" title="Attention by Type" rows={attentionSummary.byType} />


            <HighValueAttentionLeads
              rows={attentionSummary.rows}
            />
          </section>

          <AttentionRequiredPanel
            rows={attentionSummary.rows}
            onViewLead={leadId => router.push(`/admin/leads/${leadId}`)}
          />
        </section>
      )}

      {activeTab === "engagement" && (
        <section className="space-y-6">
          <SectionHeader
            icon={Activity}
            title="Agent Acquisition & Engagement"
            description="Separate who added the agent from who performed the calling and follow-up work."
          />

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <EngagementKpiCard label="New Agents Added" value={engagementTotals.newAgentsAdded} />
            <EngagementKpiCard label="First Calls Done" value={engagementTotals.firstCallsCompleted} />
            <EngagementKpiCard label="Pending First Call" value={engagementTotals.pendingFirstCalls} />
            <EngagementKpiCard label="Contact Rate" value={`${engagementTotals.newAgentContactRate}%`} />
            <EngagementKpiCard label="All Calls" value={engagementTotals.calls} />
            <EngagementKpiCard label="Unique Agents Called" value={engagementTotals.uniqueAgentsCalled} />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            <strong>First Call</strong> is counted once per new travel agent and credited to the team member who made that first call. Repeat calls are counted only under All Calls / Follow-up Calls, so the first-call number can never be inflated by repeated dialing.
          </div>

          <ChartShell
            icon={Activity}
            tone="blue"
            title="Engagement by Channel"
            description="Distribution of calls, WhatsApp, emails and meetings for the selected period."
            rightContent={
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {periodEngagements.length} Engagements
              </span>
            }
          >
            <div className="min-h-[280px]">
              {periodEngagements.length ? (
                <EngagementByChannelChart engagements={periodEngagements} />
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                  <div className="text-center">
                    <Activity className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-3 text-sm font-medium text-gray-700">
                      No engagement activity
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Calls, WhatsApp, emails and meetings will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ChartShell>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={Users} tone="purple" title="Engagement by Team Member" rows={engagementTotals.byCreator} />
            <MiniBarList
              icon={AlertTriangle}
              tone="red"
              title="Agent Record Outcomes"
              rows={[
                { name: "Invalid Number", count: engagementTotals.invalidNumber },
                { name: "Business Shut Down", count: engagementTotals.businessShutDown },
                { name: "Wrong Details", count: engagementTotals.wrongDetails },
                { name: "Do Not Contact", count: engagementTotals.doNotContact }
              ].filter(item => item.count > 0)}
            />
          </section>

          <ManagementEngagementTable rows={teamRows} onOpenMetric={openTeamMetricDetail} />
        </section>
      )}


      {activeTab === "team" && (
        <section className="space-y-6">
          <SectionHeader
            icon={Users}
            title="Team Performance"
            description="Commercial performance with permanent lead ownership, current assignment workload and engagement activity kept distinct."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Active Users" value={userTotals.activeUsers} color="blue" />
            <DashboardKpiCard label="Employee Users" value={userTotals.employeeUsers} color="green" />
            <DashboardKpiCard label="Admin Users" value={userTotals.adminUsers} color="purple" />
            <DashboardKpiCard label="Departments" value={userTotals.departments} color="blue" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={Users} tone="blue" title="Users by Department" rows={userTotals.byDepartment} />
            <MiniBarList icon={UserCheck} tone="green" title="Users by Role" rows={userTotals.byRole} />
          </section>

          <ManagementTeamTable rows={teamRows} onOpenMetric={openTeamMetricDetail} />
        </section>
      )}

      <DashboardDetailDrawer
        panel={selectedInsightPanel}
        onClose={() => {
          setSelectedInsight(null);
          setSelectedMetricPanel(null);
        }}
        onViewLead={leadId => router.push(`/admin/leads/${leadId}`)}
      />
    </main>
  );
}

