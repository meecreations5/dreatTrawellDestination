"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Languages,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";
import { generateTravelAgentCode } from "@/lib/generateTravelAgentCode";
import { checkDuplicateAgent, normalize } from "@/lib/checkDuplicateAgent";

/* =========================
   DRAFT KEY
========================= */
const DRAFT_KEY = "dreamtrawell_travel_agent_draft_v2";

/* =========================
   FORM SHAPE
========================= */
const EMPTY_FORM = {
  agencyName: "",
  agencyType: "",
  website: "",
  usp: "",
  logoUrl: "",
  status: "active",

  lifecycleStatus: "Prospect",
  approvalStatus: "Draft",

  agentCategory: "B",
  categoryReason: "",
  partnerSegment: "New Partner",
  businessPotential: "Medium",
  priorityLevel: "Medium",
  servicePriority: "Standard",
  responseSlaHours: 24,

  source: "",
  sourceDetails: "",
  referredBy: "",

  destinations: [],
  destinationIds: [],
  productTypes: [],
  marketFocus: [],

  avgTicketSize: "",

  genericContact: {
    phone: "",
    email: ""
  },

  address: {
    line1: "",
    line2: "",
    pincode: "",
    city: "",
    state: "",
    country: "India"
  },

  googleMapLink: "",

  spocs: [
    {
      name: "",
      email: "",
      mobile: "",
      designation: "",
      department: "",
      isPrimary: true
    }
  ],

  relationshipStage: "New",
  assignedTo: "",
  accountManagerUid: "",
  team: "",

  preferredCommunication: {
    whatsapp: true,
    email: true,
    call: false
  },

  preferredLanguage: "English",

  paymentTerms: "Full Advance",
  creditAllowed: false,
  creditLimit: "",
  creditDays: "",
  paymentRisk: "Low",
  paymentBehavior: "Good",

  bankDetails: {
    accountHolderName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "Current",
    upiId: "",
    beneficiaryEmail: "",
    verificationStatus: "Pending",
    remarks: ""
  },

  agreementStatus: "Not Signed",
  agreementStartDate: "",
  agreementEndDate: "",
  agreementExpiryDate: "",

  gstNumber: "",
  panNumber: "",
  kycStatus: "Pending",
  kycRemarks: "",

  riskFlags: [],
  internalRating: 3,

  followUpFrequency: "Monthly",
  nextReviewDate: "",
  relationshipGoal: "",

  strengths: [],
  weaknesses: [],
  internalNotes: ""
};

/* =========================
   OPTIONS
========================= */
const FORM_SECTIONS = [
  { id: "agency-profile", label: "Profile" },
  { id: "category", label: "Category" },
  { id: "source", label: "Source" },
  { id: "destinations", label: "Destinations" },
  { id: "contacts", label: "Contacts" },
  { id: "spocs", label: "SPOCs" },
  { id: "ownership", label: "Ownership" },
  { id: "communication", label: "Communication" },
  { id: "address", label: "Address" },
  { id: "payment", label: "Payment" },
  { id: "bank", label: "Bank" },
  { id: "compliance", label: "KYC" },
  { id: "review", label: "Review" },
  { id: "notes", label: "Notes" }
];

const PRODUCT_TYPES = [
  "FIT",
  "Group",
  "Luxury",
  "MICE",
  "Honeymoon",
  "Adventure"
];

const AGENCY_TYPES = [
  "DMC",
  "B2B Agent",
  "Corporate",
  "Retail",
  "OTA",
  "Freelance Agent",
  "Consortium"
];

const AGENT_CATEGORIES = ["A+", "A", "B", "C"];

const PARTNER_SEGMENTS = [
  "Strategic Partner",
  "Preferred Partner",
  "Regular Partner",
  "New Partner",
  "Dormant Partner",
  "Watchlist",
  "Blacklisted"
];

const BUSINESS_POTENTIALS = ["Low", "Medium", "High", "Very High"];
const PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"];
const SERVICE_PRIORITIES = ["VIP", "Priority", "Standard", "Low Priority"];

const LIFECYCLE_STATUSES = [
  "Prospect",
  "Onboarding",
  "Active Partner",
  "Preferred Partner",
  "Dormant",
  "Suspended",
  "Blacklisted"
];

const APPROVAL_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected"
];

const RELATIONSHIP_STAGES = [
  "New",
  "Active",
  "Preferred",
  "Strategic",
  "Dormant"
];

const PAYMENT_TERMS = [
  "Full Advance",
  "Partial Advance",
  "Before Travel",
  "Credit"
];

const PAYMENT_RISKS = ["Low", "Medium", "High"];
const PAYMENT_BEHAVIOR = ["Excellent", "Good", "Average", "Poor"];
const ACCOUNT_TYPES = ["Current", "Savings", "OD", "CC"];
const VERIFICATION_STATUSES = ["Pending", "Verified", "Rejected"];

const AGREEMENT_STATUSES = [
  "Not Signed",
  "Signed",
  "Expired",
  "Under Review"
];

const KYC_STATUSES = ["Pending", "Approved", "Rejected"];
const LANGUAGES = ["English", "Hindi", "Marathi"];

const SOURCES = [
  "Referral",
  "Travel Exhibition",
  "Website",
  "Social Media",
  "Cold Call",
  "Existing Network",
  "Walk-in",
  "Other"
];

const MARKET_FOCUS_OPTIONS = [
  "Domestic",
  "International",
  "Europe",
  "Dubai",
  "Thailand",
  "Singapore",
  "Honeymoon",
  "Family",
  "Group Tours",
  "MICE",
  "Luxury",
  "Budget"
];

const RISK_FLAG_OPTIONS = [
  "Slow Payment",
  "Frequent Cancellation",
  "Low Conversion",
  "Price Sensitive",
  "Poor Documentation",
  "High Complaint Risk",
  "Requires Senior Approval"
];

const FOLLOW_UP_FREQUENCIES = [
  "Daily",
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly"
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" }
];

/* =========================
   HELPERS
========================= */
function cleanString(value) {
  return typeof value === "string" ? value.trim() : value ?? null;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function splitCommaValue(value) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function joinArrayValue(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function getPrimarySpoc(spocs = []) {
  return spocs.find(spoc => spoc.isPrimary) || spocs[0] || {};
}

function buildMapUrl(form) {
  const custom = form.googleMapLink?.trim();

  if (custom && custom.startsWith("http")) {
    return custom;
  }

  const address = [
    form.address?.line1,
    form.address?.line2,
    form.address?.city,
    form.address?.state,
    form.address?.pincode,
    form.address?.country
  ]
    .filter(Boolean)
    .join(", ");

  if (!address) return "";

  return `https://www.google.com/maps?q=${encodeURIComponent(address)}`;
}

function normalizeTravelAgentForm(data = {}) {
  const existingDestinations = Array.isArray(data.destinations)
    ? data.destinations
    : [];

  const existingDestinationIds = Array.isArray(data.destinationIds)
    ? data.destinationIds
    : existingDestinations.map(item => item.id).filter(Boolean);

  const existingSpocs =
    Array.isArray(data.spocs) && data.spocs.length > 0
      ? data.spocs
      : EMPTY_FORM.spocs;

  const hasPrimary = existingSpocs.some(spoc => spoc.isPrimary);

  return {
    ...EMPTY_FORM,
    ...data,

    genericContact: {
      ...EMPTY_FORM.genericContact,
      ...(data.genericContact || {})
    },

    address: {
      ...EMPTY_FORM.address,
      ...(data.address || {})
    },

    preferredCommunication: {
      ...EMPTY_FORM.preferredCommunication,
      ...(data.preferredCommunication || {})
    },

    bankDetails: {
      ...EMPTY_FORM.bankDetails,
      ...(data.bankDetails || {})
    },

    destinations: existingDestinations,
    destinationIds: existingDestinationIds,

    productTypes: Array.isArray(data.productTypes)
      ? data.productTypes
      : [],

    marketFocus: Array.isArray(data.marketFocus)
      ? data.marketFocus
      : [],

    riskFlags: Array.isArray(data.riskFlags)
      ? data.riskFlags
      : [],

    strengths: Array.isArray(data.strengths)
      ? data.strengths
      : [],

    weaknesses: Array.isArray(data.weaknesses)
      ? data.weaknesses
      : [],

    spocs: hasPrimary
      ? existingSpocs
      : existingSpocs.map((spoc, index) => ({
          ...spoc,
          isPrimary: index === 0
        })),

    avgTicketSize:
      data.avgTicketSize === null || data.avgTicketSize === undefined
        ? ""
        : String(data.avgTicketSize),

    creditLimit:
      data.creditLimit === null || data.creditLimit === undefined
        ? ""
        : String(data.creditLimit),

    creditDays:
      data.creditDays === null || data.creditDays === undefined
        ? ""
        : String(data.creditDays),

    responseSlaHours:
      data.responseSlaHours === null || data.responseSlaHours === undefined
        ? 24
        : String(data.responseSlaHours),

    internalRating: data.internalRating || 3
  };
}

function calculateCompletion(form) {
  const primary = getPrimarySpoc(form.spocs);

  const checks = [
    {
      label: "Agency name",
      done: !!form.agencyName?.trim()
    },
    {
      label: "Agent category",
      done: !!form.agentCategory?.trim()
    },
    {
      label: "Agency type",
      done: !!form.agencyType?.trim()
    },
    {
      label: "Generic contact",
      done:
        !!form.genericContact?.phone?.trim() ||
        !!form.genericContact?.email?.trim()
    },
    {
      label: "Primary SPOC",
      done:
        !!primary?.name?.trim() &&
        (!!primary?.mobile?.trim() || !!primary?.email?.trim())
    },
    {
      label: "Destination mapping",
      done: form.destinationIds?.length > 0
    },
    {
      label: "Product type",
      done: form.productTypes?.length > 0
    },
    {
      label: "Payment terms",
      done: !!form.paymentTerms?.trim()
    },
    {
      label: "Bank details",
      done:
        !!form.bankDetails?.accountHolderName?.trim() &&
        !!form.bankDetails?.bankName?.trim()
    },
    {
      label: "KYC / Compliance",
      done:
        !!form.gstNumber?.trim() ||
        !!form.panNumber?.trim() ||
        form.kycStatus !== "Pending"
    }
  ];

  const doneCount = checks.filter(item => item.done).length;

  return {
    percentage: Math.round((doneCount / checks.length) * 100),
    missing: checks.filter(item => !item.done).map(item => item.label)
  };
}

function validateForm(form) {
  const errors = {};
  const primarySpoc = getPrimarySpoc(form.spocs);

  if (!form.agencyName?.trim()) {
    errors.agencyName = "Agency name is required.";
  }

  if (
    !form.genericContact?.phone?.trim() &&
    !form.genericContact?.email?.trim()
  ) {
    errors.genericContact =
      "Add at least one generic phone number or email address.";
  }

  if (!primarySpoc?.name?.trim()) {
    errors.primarySpocName = "Primary SPOC name is required.";
  }

  if (!primarySpoc?.mobile?.trim() && !primarySpoc?.email?.trim()) {
    errors.primarySpocContact =
      "Primary SPOC needs mobile number or email address.";
  }

  if (form.avgTicketSize && Number(form.avgTicketSize) < 0) {
    errors.avgTicketSize = "Average ticket size cannot be negative.";
  }

  if (form.creditLimit && Number(form.creditLimit) < 0) {
    errors.creditLimit = "Credit limit cannot be negative.";
  }

  if (form.creditDays && Number(form.creditDays) < 0) {
    errors.creditDays = "Credit days cannot be negative.";
  }

  if (
    form.address?.country === "India" &&
    form.address?.pincode &&
    form.address.pincode.length !== 6
  ) {
    errors.pincode = "Indian pincode should be 6 digits.";
  }

  if (
    form.bankDetails?.ifscCode &&
    form.bankDetails.ifscCode.trim().length !== 11
  ) {
    errors.ifscCode = "IFSC code should be 11 characters.";
  }

  return errors;
}

function buildTravelAgentPayload(form) {
  const spocs =
    Array.isArray(form.spocs) && form.spocs.length > 0
      ? form.spocs
      : EMPTY_FORM.spocs;

  const hasPrimary = spocs.some(spoc => spoc.isPrimary);

  const cleanedSpocs = spocs.map((spoc, index) => ({
    name: cleanString(spoc.name),
    email: cleanString(spoc.email),
    mobile: cleanString(spoc.mobile),
    designation: cleanString(spoc.designation),
    department: cleanString(spoc.department),
    isPrimary: hasPrimary ? !!spoc.isPrimary : index === 0
  }));

  const destinations = Array.isArray(form.destinations)
    ? form.destinations.map(destination => ({
        id: destination.id,
        name: destination.name
      }))
    : [];

  return {
    agencyName: cleanString(form.agencyName),
    agencyType: cleanString(form.agencyType),
    website: cleanString(form.website),
    usp: cleanString(form.usp),
    logoUrl: cleanString(form.logoUrl),
    status: cleanString(form.status),

    lifecycleStatus: cleanString(form.lifecycleStatus),
    approvalStatus: cleanString(form.approvalStatus),

    agentCategory: cleanString(form.agentCategory),
    categoryReason: cleanString(form.categoryReason),
    partnerSegment: cleanString(form.partnerSegment),
    businessPotential: cleanString(form.businessPotential),
    priorityLevel: cleanString(form.priorityLevel),
    servicePriority: cleanString(form.servicePriority),
    responseSlaHours: numberOrNull(form.responseSlaHours),

    source: cleanString(form.source),
    sourceDetails: cleanString(form.sourceDetails),
    referredBy: cleanString(form.referredBy),

    destinations,
    destinationIds: destinations.map(destination => destination.id),
    productTypes: Array.isArray(form.productTypes) ? form.productTypes : [],
    marketFocus: Array.isArray(form.marketFocus) ? form.marketFocus : [],

    avgTicketSize: numberOrNull(form.avgTicketSize),

    genericContact: {
      phone: normalize(form.genericContact?.phone || ""),
      email: normalize(form.genericContact?.email || "")
    },

    address: {
      line1: cleanString(form.address?.line1),
      line2: cleanString(form.address?.line2),
      pincode: cleanString(form.address?.pincode),
      city: cleanString(form.address?.city),
      state: cleanString(form.address?.state),
      country: cleanString(form.address?.country || "India")
    },

    googleMapLink: cleanString(form.googleMapLink),
    spocs: cleanedSpocs,

    relationshipStage: cleanString(form.relationshipStage),
    assignedTo: cleanString(form.assignedTo),
    accountManagerUid: cleanString(form.accountManagerUid),
    team: cleanString(form.team),

    preferredCommunication: {
      whatsapp: !!form.preferredCommunication?.whatsapp,
      email: !!form.preferredCommunication?.email,
      call: !!form.preferredCommunication?.call
    },

    preferredLanguage: cleanString(form.preferredLanguage),

    paymentTerms: cleanString(form.paymentTerms),
    creditAllowed: !!form.creditAllowed,
    creditLimit: numberOrNull(form.creditLimit),
    creditDays: numberOrNull(form.creditDays),
    paymentRisk: cleanString(form.paymentRisk),
    paymentBehavior: cleanString(form.paymentBehavior),

    bankDetails: {
      accountHolderName: cleanString(form.bankDetails?.accountHolderName),
      bankName: cleanString(form.bankDetails?.bankName),
      branchName: cleanString(form.bankDetails?.branchName),
      accountNumber: cleanString(form.bankDetails?.accountNumber),
      ifscCode: cleanString(form.bankDetails?.ifscCode)?.toUpperCase() || "",
      accountType: cleanString(form.bankDetails?.accountType),
      upiId: cleanString(form.bankDetails?.upiId),
      beneficiaryEmail: cleanString(form.bankDetails?.beneficiaryEmail),
      verificationStatus: cleanString(form.bankDetails?.verificationStatus),
      remarks: cleanString(form.bankDetails?.remarks)
    },

    agreementStatus: cleanString(form.agreementStatus),
    agreementStartDate: cleanString(form.agreementStartDate),
    agreementEndDate: cleanString(form.agreementEndDate),
    agreementExpiryDate: cleanString(form.agreementExpiryDate),

    gstNumber: cleanString(form.gstNumber)?.toUpperCase() || "",
    panNumber: cleanString(form.panNumber)?.toUpperCase() || "",
    kycStatus: cleanString(form.kycStatus),
    kycRemarks: cleanString(form.kycRemarks),

    riskFlags: Array.isArray(form.riskFlags) ? form.riskFlags : [],
    internalRating: numberOrNull(form.internalRating) || 3,

    followUpFrequency: cleanString(form.followUpFrequency),
    nextReviewDate: cleanString(form.nextReviewDate),
    relationshipGoal: cleanString(form.relationshipGoal),

    strengths: Array.isArray(form.strengths) ? form.strengths : [],
    weaknesses: Array.isArray(form.weaknesses) ? form.weaknesses : [],
    internalNotes: cleanString(form.internalNotes)
  };
}

function getSectionStatuses(form) {
  const primary = getPrimarySpoc(form.spocs);

  return {
    "agency-profile":
      form.agencyName && form.agencyType ? "success" : "warning",

    category:
      form.agentCategory && form.partnerSegment && form.categoryReason
        ? "success"
        : "warning",

    source: form.source ? "success" : "default",

    destinations:
      form.destinationIds?.length > 0 && form.productTypes?.length > 0
        ? "success"
        : "warning",

    contacts:
      form.genericContact?.phone || form.genericContact?.email
        ? "success"
        : "warning",

    spocs:
      primary?.name && (primary?.mobile || primary?.email)
        ? "success"
        : "warning",

    ownership:
      form.assignedTo || form.accountManagerUid || form.team
        ? "success"
        : "warning",

    communication:
      form.preferredCommunication?.whatsapp ||
      form.preferredCommunication?.email ||
      form.preferredCommunication?.call
        ? "success"
        : "warning",

    address:
      form.address?.line1 && form.address?.city && form.address?.state
        ? "success"
        : "default",

    payment:
      form.paymentTerms && form.paymentRisk ? "success" : "warning",

    bank:
      form.bankDetails?.accountHolderName && form.bankDetails?.bankName
        ? form.bankDetails?.verificationStatus === "Verified"
          ? "success"
          : "warning"
        : "default",

    compliance:
      form.kycStatus === "Approved"
        ? "success"
        : form.gstNumber || form.panNumber
        ? "warning"
        : "default",

    review:
      form.followUpFrequency || form.nextReviewDate ? "success" : "default",

    notes:
      form.internalNotes || form.strengths?.length || form.weaknesses?.length
        ? "success"
        : "default"
  };
}

function getManagementWarnings(form) {
  const warnings = [];

  if (form.kycStatus !== "Approved") warnings.push("KYC Pending");
  if (form.bankDetails?.verificationStatus !== "Verified")
    warnings.push("Bank Not Verified");
  if (!form.accountManagerUid && !form.assignedTo)
    warnings.push("No Account Manager");
  if (form.paymentRisk === "High") warnings.push("High Payment Risk");
  if (form.creditAllowed && !form.creditLimit) warnings.push("Credit Limit Missing");
  if (form.agreementStatus !== "Signed") warnings.push("Agreement Pending");
  if (form.status === "blacklisted") warnings.push("Blacklisted");

  return warnings;
}

/* =========================
   MAIN COMPONENT
========================= */
export default function TravelAgentForm({ mode = "add", agentId }) {
  const { user } = useAuth("admin");
  const router = useRouter();

  const isEdit = mode === "edit";

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [allDestinations, setAllDestinations] = useState([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationSearch, setDestinationSearch] = useState("");

  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");

  const [errors, setErrors] = useState({});
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const initialSnapshotRef = useRef("");
  const hydratedRef = useRef(false);

  const [originalGenericContact, setOriginalGenericContact] = useState({
    phone: "",
    email: ""
  });

  const completion = useMemo(() => calculateCompletion(form), [form]);
  const mapUrl = useMemo(() => buildMapUrl(form), [form]);
  const primarySpoc = useMemo(() => getPrimarySpoc(form.spocs), [form.spocs]);
  const sectionStatuses = useMemo(() => getSectionStatuses(form), [form]);
  const managementWarnings = useMemo(() => getManagementWarnings(form), [form]);

  const filteredDestinations = useMemo(() => {
    const search = destinationSearch.trim().toLowerCase();

    if (!search) return allDestinations;

    return allDestinations.filter(destination =>
      destination.name?.toLowerCase().includes(search)
    );
  }, [allDestinations, destinationSearch]);

  /* =========================
     LOAD AGENT / DRAFT
  ========================= */
  useEffect(() => {
    let active = true;

    async function loadAgent() {
      if (!isEdit) {
        try {
          const draft = localStorage.getItem(DRAFT_KEY);
          if (draft) setDraftAvailable(true);
        } catch {
          // ignore
        }

        initialSnapshotRef.current = JSON.stringify(EMPTY_FORM);
        hydratedRef.current = true;
        setLoading(false);
        return;
      }

      if (!agentId) {
        router.replace("/admin/travel-agents");
        return;
      }

      try {
        setLoading(true);

        const snap = await getDoc(doc(db, "travelAgents", agentId));

        if (!snap.exists()) {
          router.replace("/admin/travel-agents");
          return;
        }

        if (!active) return;

        const data = snap.data();
        const nextForm = normalizeTravelAgentForm(data);

        setForm(nextForm);

        initialSnapshotRef.current = JSON.stringify(nextForm);
        hydratedRef.current = true;

        setOriginalGenericContact({
          phone: normalize(data.genericContact?.phone || ""),
          email: normalize(data.genericContact?.email || "")
        });
      } catch (error) {
        console.error("Failed to load travel agent:", error);
        alert("Unable to load travel agent details.");
        router.replace("/admin/travel-agents");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAgent();

    return () => {
      active = false;
    };
  }, [isEdit, agentId, router]);

  /* =========================
     AUTO DRAFT + DIRTY CHECK
  ========================= */
  useEffect(() => {
    if (loading || !hydratedRef.current) return;

    const currentSnapshot = JSON.stringify(form);
    const dirty =
      !!initialSnapshotRef.current &&
      currentSnapshot !== initialSnapshotRef.current;

    setHasUnsavedChanges(dirty);

    if (!isEdit && dirty) {
      try {
        localStorage.setItem(DRAFT_KEY, currentSnapshot);
      } catch {
        // ignore storage errors
      }
    }
  }, [form, loading, isEdit]);

  /* =========================
     UNSAVED CHANGES WARNING
  ========================= */
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = event => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  /* =========================
     LOAD DESTINATIONS
  ========================= */
  useEffect(() => {
    let active = true;

    async function loadDestinations() {
      try {
        setDestinationsLoading(true);

        const snap = await getDocs(
          query(collection(db, "destinations"), where("active", "==", true))
        );

        if (!active) return;

        const rows = snap.docs
          .map(item => ({
            id: item.id,
            name: item.data().name || item.data().destinationName || "Untitled"
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAllDestinations(rows);
      } catch (error) {
        console.error("Failed to load destinations:", error);
      } finally {
        if (active) setDestinationsLoading(false);
      }
    }

    loadDestinations();

    return () => {
      active = false;
    };
  }, []);

  /* =========================
     DRAFT ACTIONS
  ========================= */
  const restoreDraft = () => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (!draft) return;

      const parsed = JSON.parse(draft);
      const restored = normalizeTravelAgentForm(parsed);

      setForm(restored);
      setDraftAvailable(false);
    } catch {
      alert("Unable to restore draft.");
    }
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }

    setDraftAvailable(false);
  };

  /* =========================
     ADDRESS AUTO-FILL
  ========================= */
  const fetchCityStateFromPincode = async pincode => {
    const cleanPincode = pincode.trim();

    if (form.address.country !== "India") return;
    if (!cleanPincode) return;

    if (cleanPincode.length !== 6) {
      setAddressError("Indian pincode should be 6 digits.");
      return;
    }

    try {
      setAddressLoading(true);
      setAddressError("");

      const res = await fetch(
        `https://api.postalpincode.in/pincode/${cleanPincode}`
      );

      const data = await res.json();

      if (data?.[0]?.Status !== "Success") {
        throw new Error("Invalid pincode");
      }

      const postOffice = data[0].PostOffice?.[0];

      if (!postOffice) {
        throw new Error("Pincode not found");
      }

      setForm(prev => ({
        ...prev,
        address: {
          ...prev.address,
          pincode: cleanPincode,
          city: postOffice.District || "",
          state: postOffice.State || "",
          country: "India"
        }
      }));
    } catch {
      setAddressError("Invalid pincode. Please enter city/state manually.");
      setForm(prev => ({
        ...prev,
        address: {
          ...prev.address,
          city: "",
          state: ""
        }
      }));
    } finally {
      setAddressLoading(false);
    }
  };

  /* =========================
     MULTI SELECT HELPERS
  ========================= */
  const toggleArrayValue = (field, value) => {
    setForm(prev => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];

      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter(item => item !== value)
          : [...current, value]
      };
    });
  };

  const toggleDestination = destination => {
    const exists = form.destinationIds.includes(destination.id);

    const nextDestinations = exists
      ? form.destinations.filter(item => item.id !== destination.id)
      : [...form.destinations, destination];

    setForm(prev => ({
      ...prev,
      destinations: nextDestinations,
      destinationIds: nextDestinations.map(item => item.id)
    }));
  };

  const removeDestination = destinationId => {
    const nextDestinations = form.destinations.filter(
      item => item.id !== destinationId
    );

    setForm(prev => ({
      ...prev,
      destinations: nextDestinations,
      destinationIds: nextDestinations.map(item => item.id)
    }));
  };

  /* =========================
     SPOC HANDLERS
  ========================= */
  const updateSpoc = (index, field, value) => {
    const spocs = [...form.spocs];

    spocs[index] = {
      ...spocs[index],
      [field]: value
    };

    setForm(prev => ({
      ...prev,
      spocs
    }));
  };

  const addSpoc = () => {
    setForm(prev => ({
      ...prev,
      spocs: [
        ...prev.spocs,
        {
          name: "",
          email: "",
          mobile: "",
          designation: "",
          department: "",
          isPrimary: false
        }
      ]
    }));
  };

  const removeSpoc = index => {
    if (form.spocs.length === 1) return;

    let spocs = form.spocs.filter((_, i) => i !== index);

    if (!spocs.some(spoc => spoc.isPrimary)) {
      spocs = spocs.map((spoc, i) => ({
        ...spoc,
        isPrimary: i === 0
      }));
    }

    setForm(prev => ({
      ...prev,
      spocs
    }));
  };

  const setPrimarySpoc = index => {
    setForm(prev => ({
      ...prev,
      spocs: prev.spocs.map((spoc, i) => ({
        ...spoc,
        isPrimary: i === index
      }))
    }));
  };

  const copyGenericToPrimarySpoc = () => {
    const primaryIndex = form.spocs.findIndex(spoc => spoc.isPrimary);
    const index = primaryIndex >= 0 ? primaryIndex : 0;

    const spocs = [...form.spocs];

    spocs[index] = {
      ...spocs[index],
      email: spocs[index].email || form.genericContact.email,
      mobile: spocs[index].mobile || form.genericContact.phone,
      isPrimary: true
    };

    setForm(prev => ({
      ...prev,
      spocs
    }));
  };

  const useAgencyNameForBank = () => {
    setForm(prev => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        accountHolderName:
          prev.bankDetails.accountHolderName || prev.agencyName
      }
    }));
  };

  const markBankVerified = () => {
    setForm(prev => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        verificationStatus: "Verified"
      }
    }));
  };

  const setCategoryDefaults = category => {
    const defaults = {
      "A+": {
        partnerSegment: "Strategic Partner",
        businessPotential: "Very High",
        priorityLevel: "Critical",
        servicePriority: "VIP",
        responseSlaHours: 2
      },
      A: {
        partnerSegment: "Preferred Partner",
        businessPotential: "High",
        priorityLevel: "High",
        servicePriority: "Priority",
        responseSlaHours: 6
      },
      B: {
        partnerSegment: "Regular Partner",
        businessPotential: "Medium",
        priorityLevel: "Medium",
        servicePriority: "Standard",
        responseSlaHours: 24
      },
      C: {
        partnerSegment: "New Partner",
        businessPotential: "Low",
        priorityLevel: "Low",
        servicePriority: "Low Priority",
        responseSlaHours: 48
      }
    };

    setForm(prev => ({
      ...prev,
      agentCategory: category,
      ...defaults[category]
    }));
  };

  const scrollToSection = sectionId => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (submitting) return;

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      alert("Please complete the required fields before saving.");
      return;
    }

    if (!user?.uid && !isEdit) {
      alert("User session not found. Please login again.");
      return;
    }

    try {
      setSubmitting(true);

      const phone = normalize(form.genericContact?.phone || "");
      const email = normalize(form.genericContact?.email || "");

      const genericContactChanged =
        phone !== originalGenericContact.phone ||
        email !== originalGenericContact.email;

      const shouldCheckDuplicate =
        !!phone || !!email ? !isEdit || genericContactChanged : false;

      if (shouldCheckDuplicate) {
        const isDuplicate = await checkDuplicateAgent(
          phone,
          email,
          isEdit ? agentId : null
        );

        if (isDuplicate) {
          alert("Generic contact already exists for another Travel Agent.");
          setSubmitting(false);
          return;
        }
      }

      const payload = buildTravelAgentPayload(form);

      if (isEdit) {
        await updateDoc(doc(db, "travelAgents", agentId), {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedByUid: user?.uid || null
        });
      } else {
        const ref = doc(collection(db, "travelAgents"));

        await setDoc(ref, {
          ...payload,
          agentCode: await generateTravelAgentCode(),
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
      }

      setHasUnsavedChanges(false);
      router.replace("/admin/travel-agents");
    } catch (error) {
      console.error("Failed to save travel agent:", error);
      alert("Unable to save travel agent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <AdminGuard>
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="min-h-screen p-4 pb-32 md:p-6 md:pb-32">
        <div className="mx-auto max-w-9xl space-y-6">
          {/* HEADER */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 p-5 text-white md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={() => router.push("/admin/travel-agents")}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-50 hover:text-white"
                  >
                    <ArrowLeft size={16} />
                    Back to Travel Agents
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                      <Building2 size={24} />
                    </div>

                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        {isEdit ? "Edit Travel Agent" : "Add Travel Agent"}
                      </h1>
                      <p className="mt-1 text-sm text-blue-50">
                        Manage agent category, contacts, destinations, payment
                        terms, bank details, KYC and internal relationship plan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/15 p-3 text-sm ring-1 ring-white/20">
                  <HeaderMiniStat label="Category" value={form.agentCategory} />
                  <HeaderMiniStat label="KYC" value={form.kycStatus} />
                  <HeaderMiniStat label="Complete" value={`${completion.percentage}%`} />
                </div>
              </div>
            </div>
          </div>

          {/* DRAFT RESTORE */}
          {!isEdit && draftAvailable && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3">
                <RotateCcw className="mt-0.5 text-amber-700" size={18} />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Unsaved travel agent draft found
                  </p>
                  <p className="text-xs text-amber-700">
                    You can restore your previous draft or discard it and start fresh.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={discardDraft}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={restoreDraft}
                  className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Restore Draft
                </button>
              </div>
            </div>
          )}

          {/* SECTION NAV */}
          <div className="sticky top-20 z-30 -mx-4 border-y border-slate-200 px-4 py-3  backdrop-blur md:-mx-6 md:px-6">
            <div className="mx-auto flex max-w-9xl gap-2 overflow-x-auto">
              {FORM_SECTIONS.map(section => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <span>{section.label}</span>
                  <NavDot type={sectionStatuses[section.id]} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {/* AGENCY PROFILE */}
              <Section
                id="agency-profile"
                title="Agency Profile"
                description="Main travel agent identity and public information."
                icon={<Building2 size={18} />}
                status={sectionStatuses["agency-profile"]}
              >
                <Grid cols={2}>
                  <Field label="Agency Name" required error={errors.agencyName}>
                    <Input
                      placeholder="Example: Vigo World Holidays Travels"
                      value={form.agencyName}
                      error={errors.agencyName}
                      onChange={e =>
                        setForm({ ...form, agencyName: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Agency Type">
                    <Select
                      value={form.agencyType}
                      onChange={e =>
                        setForm({ ...form, agencyType: e.target.value })
                      }
                    >
                      <option value="">Select agency type</option>
                      {AGENCY_TYPES.map(type => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Website">
                    <Input
                      placeholder="https://example.com"
                      value={form.website}
                      onChange={e =>
                        setForm({ ...form, website: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Logo URL">
                    <Input
                      placeholder="https://..."
                      value={form.logoUrl}
                      onChange={e =>
                        setForm({ ...form, logoUrl: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="USP / Positioning" className="md:col-span-2">
                    <Input
                      placeholder="Example: Europe specialist, strong MICE network..."
                      value={form.usp}
                      onChange={e =>
                        setForm({ ...form, usp: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Status">
                    <Select
                      value={form.status}
                      onChange={e =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Lifecycle Status">
                    <Select
                      value={form.lifecycleStatus}
                      onChange={e =>
                        setForm({ ...form, lifecycleStatus: e.target.value })
                      }
                    >
                      {LIFECYCLE_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </Grid>
              </Section>

              {/* CATEGORY */}
              <Section
                id="category"
                title="Category, Segment & Priority"
                description="Classify the travel agent for management visibility and service priority."
                icon={<BadgeCheck size={18} />}
                status={sectionStatuses.category}
                right={
                  <div className="flex flex-wrap gap-2">
                    {AGENT_CATEGORIES.map(category => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setCategoryDefaults(category)}
                        className={`
                          rounded-full border px-3 py-1 text-xs font-semibold transition
                          ${
                            form.agentCategory === category
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }
                        `}
                      >
                        Set {category}
                      </button>
                    ))}
                  </div>
                }
              >
                <Grid cols={3}>
                  <Field label="Agent Category">
                    <Select
                      value={form.agentCategory}
                      onChange={e =>
                        setCategoryDefaults(e.target.value)
                      }
                    >
                      {AGENT_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Partner Segment">
                    <Select
                      value={form.partnerSegment}
                      onChange={e =>
                        setForm({ ...form, partnerSegment: e.target.value })
                      }
                    >
                      {PARTNER_SEGMENTS.map(segment => (
                        <option key={segment} value={segment}>
                          {segment}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Business Potential">
                    <Select
                      value={form.businessPotential}
                      onChange={e =>
                        setForm({
                          ...form,
                          businessPotential: e.target.value
                        })
                      }
                    >
                      {BUSINESS_POTENTIALS.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Priority Level">
                    <Select
                      value={form.priorityLevel}
                      onChange={e =>
                        setForm({ ...form, priorityLevel: e.target.value })
                      }
                    >
                      {PRIORITY_LEVELS.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Service Priority">
                    <Select
                      value={form.servicePriority}
                      onChange={e =>
                        setForm({ ...form, servicePriority: e.target.value })
                      }
                    >
                      {SERVICE_PRIORITIES.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Response SLA Hours">
                    <Input
                      type="number"
                      value={form.responseSlaHours}
                      onChange={e =>
                        setForm({
                          ...form,
                          responseSlaHours: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Category Reason" className="md:col-span-3">
                    <Input
                      placeholder="Example: High lead volume, good payment behavior, strategic Europe partner..."
                      value={form.categoryReason}
                      onChange={e =>
                        setForm({ ...form, categoryReason: e.target.value })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* SOURCE */}
              <Section
                id="source"
                title="Source & Acquisition"
                description="Track how this travel agent was acquired."
                icon={<CheckCircle2 size={18} />}
                status={sectionStatuses.source}
              >
                <Grid cols={3}>
                  <Field label="Source">
                    <Select
                      value={form.source}
                      onChange={e =>
                        setForm({ ...form, source: e.target.value })
                      }
                    >
                      <option value="">Select source</option>
                      {SOURCES.map(source => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Referred By">
                    <Input
                      placeholder="Name / agent / employee"
                      value={form.referredBy}
                      onChange={e =>
                        setForm({ ...form, referredBy: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Approval Status">
                    <Select
                      value={form.approvalStatus}
                      onChange={e =>
                        setForm({ ...form, approvalStatus: e.target.value })
                      }
                    >
                      {APPROVAL_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Source Details" className="md:col-span-3">
                    <Input
                      placeholder="Event name, referral note, campaign name..."
                      value={form.sourceDetails}
                      onChange={e =>
                        setForm({ ...form, sourceDetails: e.target.value })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* DESTINATIONS */}
              <Section
                id="destinations"
                title="Destinations & Market Focus"
                description="Map destinations and business segments this travel agent handles."
                icon={<MapPin size={18} />}
                status={sectionStatuses.destinations}
                right={<Badge>{form.destinationIds.length} selected</Badge>}
              >
                {form.destinations.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.destinations.map(destination => (
                      <Chip
                        key={destination.id}
                        label={destination.name}
                        onRemove={() => removeDestination(destination.id)}
                      />
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    placeholder="Search destination..."
                    value={destinationSearch}
                    onChange={e => setDestinationSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {destinationsLoading ? (
                    <p className="text-sm text-slate-500">
                      Loading destinations...
                    </p>
                  ) : filteredDestinations.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No active destinations found.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredDestinations.map(destination => {
                        const checked = form.destinationIds.includes(
                          destination.id
                        );

                        return (
                          <label
                            key={destination.id}
                            className={`
                              flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition
                              ${
                                checked
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                              }
                            `}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDestination(destination)}
                            />
                            <span className="truncate">
                              {destination.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Field label="Market Focus">
                  <ChipSelector
                    options={MARKET_FOCUS_OPTIONS}
                    selected={form.marketFocus}
                    onToggle={value => toggleArrayValue("marketFocus", value)}
                  />
                </Field>

                <Field label="Product Types">
                  <ChipSelector
                    options={PRODUCT_TYPES}
                    selected={form.productTypes}
                    onToggle={value => toggleArrayValue("productTypes", value)}
                  />
                </Field>

                <Field
                  label="Average Ticket Size"
                  error={errors.avgTicketSize}
                >
                  <Input
                    type="number"
                    placeholder="Example: 75000"
                    value={form.avgTicketSize}
                    error={errors.avgTicketSize}
                    onChange={e =>
                      setForm({ ...form, avgTicketSize: e.target.value })
                    }
                  />
                </Field>
              </Section>

              {/* GENERIC CONTACT */}
              <Section
                id="contacts"
                title="Generic Contact"
                description="Main agency-level phone/email used for communication and duplicate checks."
                icon={<UserRound size={18} />}
                status={sectionStatuses.contacts}
              >
                {errors.genericContact && (
                  <AlertMessage>{errors.genericContact}</AlertMessage>
                )}

                <Grid cols={2}>
                  <Field label="Generic Phone">
                    <Input
                      placeholder="Phone / WhatsApp number"
                      value={form.genericContact.phone}
                      onChange={e =>
                        setForm({
                          ...form,
                          genericContact: {
                            ...form.genericContact,
                            phone: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Generic Email">
                    <Input
                      placeholder="agency@example.com"
                      type="email"
                      value={form.genericContact.email}
                      onChange={e =>
                        setForm({
                          ...form,
                          genericContact: {
                            ...form.genericContact,
                            email: e.target.value
                          }
                        })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* SPOCS */}
              <Section
                id="spocs"
                title="SPOCs"
                description="Add decision makers, sales contacts, operations contacts and accounts contacts."
                icon={<UserRound size={18} />}
                status={sectionStatuses.spocs}
                right={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyGenericToPrimarySpoc}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Copy Generic Contact
                    </button>

                    <button
                      type="button"
                      onClick={addSpoc}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <Plus size={15} />
                      Add SPOC
                    </button>
                  </div>
                }
              >
                {(errors.primarySpocName || errors.primarySpocContact) && (
                  <AlertMessage>
                    {errors.primarySpocName || errors.primarySpocContact}
                  </AlertMessage>
                )}

                <div className="space-y-4">
                  {form.spocs.map((spoc, index) => (
                    <SpocCard
                      key={`spoc-${index}`}
                      spoc={spoc}
                      index={index}
                      isOnlyOne={form.spocs.length === 1}
                      onChange={(field, value) =>
                        updateSpoc(index, field, value)
                      }
                      onRemove={() => removeSpoc(index)}
                      onSetPrimary={() => setPrimarySpoc(index)}
                    />
                  ))}
                </div>
              </Section>

              {/* RELATIONSHIP */}
              <Section
                id="ownership"
                title="Relationship Ownership"
                description="Internal team ownership and relationship stage."
                icon={<Building2 size={18} />}
                status={sectionStatuses.ownership}
              >
                <Grid cols={2}>
                  <Field label="Relationship Stage">
                    <Select
                      value={form.relationshipStage}
                      onChange={e =>
                        setForm({
                          ...form,
                          relationshipStage: e.target.value
                        })
                      }
                    >
                      {RELATIONSHIP_STAGES.map(stage => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Team">
                    <Input
                      placeholder="Corporate, Leisure, MICE..."
                      value={form.team}
                      onChange={e =>
                        setForm({
                          ...form,
                          team: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Assigned To">
                    <Input
                      placeholder="User UID / email / name"
                      value={form.assignedTo}
                      onChange={e =>
                        setForm({
                          ...form,
                          assignedTo: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Account Manager UID">
                    <Input
                      placeholder="Account manager UID"
                      value={form.accountManagerUid}
                      onChange={e =>
                        setForm({
                          ...form,
                          accountManagerUid: e.target.value
                        })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* COMMUNICATION */}
              <Section
                id="communication"
                title="Communication Preferences"
                description="Preferred channels and language for this travel agent."
                icon={<Languages size={18} />}
                status={sectionStatuses.communication}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Preferred Channels
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <TogglePill
                        label="WhatsApp"
                        checked={!!form.preferredCommunication?.whatsapp}
                        onChange={checked =>
                          setForm({
                            ...form,
                            preferredCommunication: {
                              ...form.preferredCommunication,
                              whatsapp: checked
                            }
                          })
                        }
                      />

                      <TogglePill
                        label="Email"
                        checked={!!form.preferredCommunication?.email}
                        onChange={checked =>
                          setForm({
                            ...form,
                            preferredCommunication: {
                              ...form.preferredCommunication,
                              email: checked
                            }
                          })
                        }
                      />

                      <TogglePill
                        label="Phone Call"
                        checked={!!form.preferredCommunication?.call}
                        onChange={checked =>
                          setForm({
                            ...form,
                            preferredCommunication: {
                              ...form.preferredCommunication,
                              call: checked
                            }
                          })
                        }
                      />
                    </div>
                  </div>

                  <Field label="Preferred Language">
                    <Select
                      value={form.preferredLanguage}
                      onChange={e =>
                        setForm({
                          ...form,
                          preferredLanguage: e.target.value
                        })
                      }
                    >
                      {LANGUAGES.map(language => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Section>

              {/* ADDRESS */}
              <Section
                id="address"
                title="Address"
                description="Office address and map reference."
                icon={<MapPin size={18} />}
                status={sectionStatuses.address}
              >
                <Grid cols={2}>
                  <Field label="Address Line 1" className="md:col-span-2">
                    <Input
                      placeholder="Office / building / street"
                      value={form.address.line1}
                      onChange={e =>
                        setForm({
                          ...form,
                          address: {
                            ...form.address,
                            line1: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Address Line 2" className="md:col-span-2">
                    <Input
                      placeholder="Area / landmark"
                      value={form.address.line2}
                      onChange={e =>
                        setForm({
                          ...form,
                          address: {
                            ...form.address,
                            line2: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Country">
                    <Select
                      value={form.address.country}
                      onChange={e =>
                        setForm({
                          ...form,
                          address: {
                            ...form.address,
                            country: e.target.value,
                            pincode: "",
                            city: "",
                            state: ""
                          }
                        })
                      }
                    >
                      <option value="India">India</option>
                      <option value="Other">Other</option>
                    </Select>
                  </Field>

                  {form.address.country === "India" && (
                    <Field
                      label="Pincode"
                      error={errors.pincode || addressError}
                      hint={
                        addressLoading
                          ? "Fetching city/state..."
                          : "City and state will auto-fill on blur."
                      }
                    >
                      <Input
                        placeholder="6 digit pincode"
                        value={form.address.pincode}
                        maxLength={6}
                        error={errors.pincode || addressError}
                        onChange={e => {
                          setAddressError("");
                          setForm({
                            ...form,
                            address: {
                              ...form.address,
                              pincode: e.target.value.replace(/\D/g, "")
                            }
                          });
                        }}
                        onBlur={e => fetchCityStateFromPincode(e.target.value)}
                      />
                    </Field>
                  )}

                  <Field label="City">
                    <Input
                      placeholder="City"
                      disabled={form.address.country === "India"}
                      value={form.address.city}
                      onChange={e =>
                        setForm({
                          ...form,
                          address: {
                            ...form.address,
                            city: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="State">
                    <Input
                      placeholder="State"
                      disabled={form.address.country === "India"}
                      value={form.address.state}
                      onChange={e =>
                        setForm({
                          ...form,
                          address: {
                            ...form.address,
                            state: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Custom Google Map Link" className="md:col-span-2">
                    <Input
                      placeholder="Optional Google Maps link"
                      value={form.googleMapLink}
                      onChange={e =>
                        setForm({
                          ...form,
                          googleMapLink: e.target.value
                        })
                      }
                    />
                  </Field>
                </Grid>

                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                  >
                    <MapPin size={15} />
                    View on Google Maps
                  </a>
                )}
              </Section>

              {/* PAYMENT */}
              <Section
                id="payment"
                title="Payment, Credit & Risk"
                description="Commercial behavior of the travel agent. Useful before accepting new bookings."
                icon={<CreditCard size={18} />}
                status={sectionStatuses.payment}
              >
                <InfoBox
                  tone="amber"
                  title="Payment Control"
                  text="These fields help your team decide whether bookings can be accepted on advance, partial advance or credit terms."
                />

                <Grid cols={3}>
                  <Field label="Payment Terms">
                    <Select
                      value={form.paymentTerms}
                      onChange={e =>
                        setForm({ ...form, paymentTerms: e.target.value })
                      }
                    >
                      {PAYMENT_TERMS.map(term => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Payment Risk">
                    <Select
                      value={form.paymentRisk}
                      onChange={e =>
                        setForm({ ...form, paymentRisk: e.target.value })
                      }
                    >
                      {PAYMENT_RISKS.map(risk => (
                        <option key={risk} value={risk}>
                          {risk}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Payment Behavior">
                    <Select
                      value={form.paymentBehavior}
                      onChange={e =>
                        setForm({ ...form, paymentBehavior: e.target.value })
                      }
                    >
                      {PAYMENT_BEHAVIOR.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Credit Allowed">
                    <Select
                      value={form.creditAllowed ? "yes" : "no"}
                      onChange={e =>
                        setForm({
                          ...form,
                          creditAllowed: e.target.value === "yes"
                        })
                      }
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </Select>
                  </Field>

                  <Field label="Credit Limit" error={errors.creditLimit}>
                    <Input
                      type="number"
                      placeholder="Example: 100000"
                      value={form.creditLimit}
                      error={errors.creditLimit}
                      onChange={e =>
                        setForm({
                          ...form,
                          creditLimit: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Credit Days" error={errors.creditDays}>
                    <Input
                      type="number"
                      placeholder="Example: 15"
                      value={form.creditDays}
                      error={errors.creditDays}
                      onChange={e =>
                        setForm({
                          ...form,
                          creditDays: e.target.value
                        })
                      }
                    />
                  </Field>
                </Grid>

                <Field label="Risk Flags">
                  <ChipSelector
                    options={RISK_FLAG_OPTIONS}
                    selected={form.riskFlags}
                    onToggle={value => toggleArrayValue("riskFlags", value)}
                    danger
                  />
                </Field>
              </Section>

              {/* BANK DETAILS */}
              <Section
                id="bank"
                title="Bank Details"
                description="Travel agent bank information for refunds, commissions, adjustments or settlements."
                icon={<Landmark size={18} />}
                status={sectionStatuses.bank}
                right={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={useAgencyNameForBank}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Use Agency Name
                    </button>

                    <button
                      type="button"
                      onClick={markBankVerified}
                      className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Mark Verified
                    </button>
                  </div>
                }
              >
                <InfoBox
                  tone="blue"
                  title="Sensitive Bank Information"
                  text="Bank details should be visible only to authorized admin or accounts users. Mask account number on listing/detail pages for non-accounts users."
                />

                <Grid cols={3}>
                  <Field label="Account Holder Name">
                    <Input
                      placeholder="Beneficiary name"
                      value={form.bankDetails.accountHolderName}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            accountHolderName: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Bank Name">
                    <Input
                      placeholder="Bank name"
                      value={form.bankDetails.bankName}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            bankName: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Branch Name">
                    <Input
                      placeholder="Branch name"
                      value={form.bankDetails.branchName}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            branchName: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Account Number">
                    <Input
                      placeholder="Account number"
                      value={form.bankDetails.accountNumber}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            accountNumber: e.target.value.replace(/\D/g, "")
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="IFSC Code" error={errors.ifscCode}>
                    <Input
                      placeholder="Example: HDFC0001234"
                      value={form.bankDetails.ifscCode}
                      error={errors.ifscCode}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            ifscCode: e.target.value.toUpperCase()
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Account Type">
                    <Select
                      value={form.bankDetails.accountType}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            accountType: e.target.value
                          }
                        })
                      }
                    >
                      {ACCOUNT_TYPES.map(type => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="UPI ID">
                    <Input
                      placeholder="example@upi"
                      value={form.bankDetails.upiId}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            upiId: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Beneficiary Email">
                    <Input
                      type="email"
                      placeholder="beneficiary@example.com"
                      value={form.bankDetails.beneficiaryEmail}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            beneficiaryEmail: e.target.value
                          }
                        })
                      }
                    />
                  </Field>

                  <Field label="Bank Verification Status">
                    <Select
                      value={form.bankDetails.verificationStatus}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            verificationStatus: e.target.value
                          }
                        })
                      }
                    >
                      {VERIFICATION_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Bank Remarks" className="md:col-span-3">
                    <Input
                      placeholder="Verification note, mismatch note, cheque reference..."
                      value={form.bankDetails.remarks}
                      onChange={e =>
                        setForm({
                          ...form,
                          bankDetails: {
                            ...form.bankDetails,
                            remarks: e.target.value
                          }
                        })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* COMPLIANCE */}
              <Section
                id="compliance"
                title="KYC, Agreement & Compliance"
                description="GST, PAN, KYC and commercial agreement status."
                icon={<ShieldCheck size={18} />}
                status={sectionStatuses.compliance}
              >
                <Grid cols={3}>
                  <Field label="GST Number">
                    <Input
                      placeholder="GST Number"
                      value={form.gstNumber}
                      onChange={e =>
                        setForm({
                          ...form,
                          gstNumber: e.target.value.toUpperCase()
                        })
                      }
                    />
                  </Field>

                  <Field label="PAN Number">
                    <Input
                      placeholder="PAN Number"
                      value={form.panNumber}
                      onChange={e =>
                        setForm({
                          ...form,
                          panNumber: e.target.value.toUpperCase()
                        })
                      }
                    />
                  </Field>

                  <Field label="KYC Status">
                    <Select
                      value={form.kycStatus}
                      onChange={e =>
                        setForm({
                          ...form,
                          kycStatus: e.target.value
                        })
                      }
                    >
                      {KYC_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Agreement Status">
                    <Select
                      value={form.agreementStatus}
                      onChange={e =>
                        setForm({
                          ...form,
                          agreementStatus: e.target.value
                        })
                      }
                    >
                      {AGREEMENT_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Agreement Start Date">
                    <Input
                      type="date"
                      value={form.agreementStartDate}
                      onChange={e =>
                        setForm({
                          ...form,
                          agreementStartDate: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Agreement End Date">
                    <Input
                      type="date"
                      value={form.agreementEndDate}
                      onChange={e =>
                        setForm({
                          ...form,
                          agreementEndDate: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Agreement Expiry Date">
                    <Input
                      type="date"
                      value={form.agreementExpiryDate}
                      onChange={e =>
                        setForm({
                          ...form,
                          agreementExpiryDate: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="KYC Remarks" className="md:col-span-2">
                    <Input
                      placeholder="KYC verification note"
                      value={form.kycRemarks}
                      onChange={e =>
                        setForm({
                          ...form,
                          kycRemarks: e.target.value
                        })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* REVIEW */}
              <Section
                id="review"
                title="Review & Follow-up Plan"
                description="Plan relationship review and future growth action."
                icon={<CheckCircle2 size={18} />}
                status={sectionStatuses.review}
              >
                <Grid cols={3}>
                  <Field label="Follow-up Frequency">
                    <Select
                      value={form.followUpFrequency}
                      onChange={e =>
                        setForm({
                          ...form,
                          followUpFrequency: e.target.value
                        })
                      }
                    >
                      {FOLLOW_UP_FREQUENCIES.map(freq => (
                        <option key={freq} value={freq}>
                          {freq}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Next Review Date">
                    <Input
                      type="date"
                      value={form.nextReviewDate}
                      onChange={e =>
                        setForm({
                          ...form,
                          nextReviewDate: e.target.value
                        })
                      }
                    />
                  </Field>

                  <Field label="Internal Rating">
                    <Select
                      value={form.internalRating}
                      onChange={e =>
                        setForm({
                          ...form,
                          internalRating: Number(e.target.value)
                        })
                      }
                    >
                      <option value={1}>1 - Poor</option>
                      <option value={2}>2 - Average</option>
                      <option value={3}>3 - Good</option>
                      <option value={4}>4 - Very Good</option>
                      <option value={5}>5 - Excellent</option>
                    </Select>
                  </Field>

                  <Field label="Relationship Goal" className="md:col-span-3">
                    <Input
                      placeholder="Example: Convert to A category, improve payment behavior, increase Europe group leads..."
                      value={form.relationshipGoal}
                      onChange={e =>
                        setForm({
                          ...form,
                          relationshipGoal: e.target.value
                        })
                      }
                    />
                  </Field>
                </Grid>
              </Section>

              {/* INTERNAL */}
              <Section
                id="notes"
                title="Internal Intelligence"
                description="Private notes for sales, accounts and operations teams."
                icon={<CheckCircle2 size={18} />}
                status={sectionStatuses.notes}
              >
                <Grid cols={2}>
                  <Field label="Strengths">
                    <Input
                      placeholder="Comma separated strengths"
                      value={joinArrayValue(form.strengths)}
                      onChange={e =>
                        setForm({
                          ...form,
                          strengths: splitCommaValue(e.target.value)
                        })
                      }
                    />
                  </Field>

                  <Field label="Weaknesses">
                    <Input
                      placeholder="Comma separated weaknesses"
                      value={joinArrayValue(form.weaknesses)}
                      onChange={e =>
                        setForm({
                          ...form,
                          weaknesses: splitCommaValue(e.target.value)
                        })
                      }
                    />
                  </Field>

                  <Field label="Internal Notes" className="md:col-span-2">
                    <TextArea
                      placeholder="Add relationship notes, payment behavior, escalation notes, special handling instructions..."
                      value={form.internalNotes}
                      onChange={e =>
                        setForm({
                          ...form,
                          internalNotes: e.target.value
                        })
                      }
                    />
                  </Field>
                </Grid>
              </Section>
            </div>

            {/* RIGHT SUMMARY */}
            <aside className="hidden lg:block">
              <div className="sticky top-[88px] space-y-4">
                <SummaryCard
                  form={form}
                  primarySpoc={primarySpoc}
                  completion={completion}
                  warnings={managementWarnings}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            </aside>
          </div>
        </div>

        <StickySaveBar
          submitting={submitting}
          hasUnsavedChanges={hasUnsavedChanges}
          completion={completion}
          onSave={save}
          onCancel={() => router.push("/admin/travel-agents")}
        />
      </main>
    </AdminGuard>
  );
}

/* =========================
   UI COMPONENTS
========================= */
function Section({ id, title, description, icon, status, right, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 "
    >
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              {icon}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
              <StatusBadge type={status} />
            </div>

            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>

        {right}
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function HeaderMiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
      <p className="text-[11px] font-medium text-blue-50">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value || "-"}</p>
    </div>
  );
}

function Field({ label, required, error, hint, className = "", children }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function Input({ className = "", error, value, ...props }) {
  return (
    <input
      {...props}
      value={value ?? ""}
      className={`
        w-full rounded-xl border px-3 py-2.5 text-sm text-slate-800 outline-none transition
        placeholder:text-slate-400
        focus:ring-4
        disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500
        ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"
        }
        ${className}
      `}
    />
  );
}

function TextArea({ className = "", value, ...props }) {
  return (
    <textarea
      {...props}
      value={value ?? ""}
      rows={4}
      className={`
        w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition
        placeholder:text-slate-400
        focus:border-blue-400 focus:ring-4 focus:ring-blue-100
        ${className}
      `}
    />
  );
}

function Select({ className = "", value, children, ...props }) {
  return (
    <select
      {...props}
      value={value ?? ""}
      className={`
        w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition
        focus:border-blue-400 focus:ring-4 focus:ring-blue-100
        ${className}
      `}
    >
      {children}
    </select>
  );
}

function Grid({ children, cols = 2 }) {
  const classes = {
    2: "grid grid-cols-1 gap-4 md:grid-cols-2",
    3: "grid grid-cols-1 gap-4 md:grid-cols-3",
    4: "grid grid-cols-1 gap-4 md:grid-cols-4"
  };

  return <div className={classes[cols] || classes[2]}>{children}</div>;
}

function Chip({ label, onRemove }) {
  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}

function StatusBadge({ type = "default" }) {
  const config = {
    success: {
      label: "Completed",
      className: "border-emerald-100 bg-emerald-50 text-emerald-700"
    },
    warning: {
      label: "Pending",
      className: "border-amber-100 bg-amber-50 text-amber-700"
    },
    danger: {
      label: "Issue",
      className: "border-red-100 bg-red-50 text-red-700"
    },
    default: {
      label: "Optional",
      className: "border-slate-200 bg-slate-50 text-slate-600"
    }
  };

  const item = config[type] || config.default;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function NavDot({ type = "default" }) {
  const classes = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    default: "bg-slate-300"
  };

  return (
    <span
      className={`h-2 w-2 rounded-full ${classes[type] || classes.default}`}
    />
  );
}

function AlertMessage({ children }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {children}
    </div>
  );
}

function InfoBox({ tone = "blue", title, text }) {
  const styles = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-800",
    amber: "border-amber-100 bg-amber-50/70 text-amber-800"
  };

  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${styles[tone]}`}>
      <Info size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 opacity-80">{text}</p>
      </div>
    </div>
  );
}

function TogglePill({ label, checked, onChange }) {
  return (
    <label
      className={`
        inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition
        ${
          checked
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
        }
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function ChipSelector({ options, selected = [], onToggle, danger = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const checked = selected.includes(option);

        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`
              rounded-full border px-3 py-1.5 text-xs font-semibold transition
              ${
                checked
                  ? danger
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
              }
            `}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SpocCard({
  spoc,
  index,
  isOnlyOne,
  onChange,
  onRemove,
  onSetPrimary
}) {
  return (
    <div
      className={`
        rounded-2xl border p-4 transition
        ${
          spoc.isPrimary
            ? "border-blue-200 bg-blue-50/50"
            : "border-slate-200 bg-white"
        }
      `}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              SPOC {index + 1}
            </p>

            {spoc.isPrimary && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                Primary
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Contact person for this travel agent.
          </p>
        </div>

        {!isOnlyOne && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={13} />
            Remove
          </button>
        )}
      </div>

      <Grid cols={2}>
        <Field label="Name">
          <Input
            placeholder="Contact person name"
            value={spoc.name}
            onChange={e => onChange("name", e.target.value)}
          />
        </Field>

        <Field label="Email">
          <Input
            placeholder="email@example.com"
            type="email"
            value={spoc.email}
            onChange={e => onChange("email", e.target.value)}
          />
        </Field>

        <Field label="Mobile">
          <Input
            placeholder="Mobile / WhatsApp"
            value={spoc.mobile}
            onChange={e => onChange("mobile", e.target.value)}
          />
        </Field>

        <Field label="Designation">
          <Input
            placeholder="Owner / Manager / Sales Head"
            value={spoc.designation}
            onChange={e => onChange("designation", e.target.value)}
          />
        </Field>

        <Field label="Department" className="md:col-span-2">
          <Input
            placeholder="Sales / Operations / Accounts"
            value={spoc.department}
            onChange={e => onChange("department", e.target.value)}
          />
        </Field>
      </Grid>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="radio"
          checked={!!spoc.isPrimary}
          onChange={onSetPrimary}
        />
        Mark as primary SPOC
      </label>
    </div>
  );
}

function SummaryCard({
  form,
  primarySpoc,
  completion,
  warnings,
  hasUnsavedChanges
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Management Summary
        </h3>

        <span
          className={`
            rounded-full px-2.5 py-1 text-xs font-semibold
            ${
              form.agentCategory === "A+"
                ? "bg-purple-50 text-purple-700"
                : form.agentCategory === "A"
                ? "bg-emerald-50 text-emerald-700"
                : form.agentCategory === "B"
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-600"
            }
          `}
        >
          {form.agentCategory} Category
        </span>
      </div>

      {hasUnsavedChanges && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          <AlertTriangle size={15} className="shrink-0" />
          Unsaved changes
        </div>
      )}

      <div className="mt-4 space-y-3">
        <SummaryRow label="Agency" value={form.agencyName || "Not added"} />
        <SummaryRow label="Segment" value={form.partnerSegment || "Not set"} />
        <SummaryRow label="Lifecycle" value={form.lifecycleStatus || "Prospect"} />
        <SummaryRow label="Primary SPOC" value={primarySpoc?.name || "Not added"} />
        <SummaryRow
          label="Generic Contact"
          value={
            form.genericContact?.phone ||
            form.genericContact?.email ||
            "Not added"
          }
        />
        <SummaryRow label="Destinations" value={`${form.destinationIds.length} selected`} />
        <SummaryRow label="Payment Risk" value={form.paymentRisk || "Low"} />
        <SummaryRow label="Payment Terms" value={form.paymentTerms || "Not set"} />
        <SummaryRow label="Bank" value={form.bankDetails?.bankName || "Not added"} />
        <SummaryRow label="Bank Status" value={form.bankDetails?.verificationStatus || "Pending"} />
        <SummaryRow label="KYC" value={form.kycStatus || "Pending"} />
      </div>

      {warnings.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">
            Attention Required
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {warnings.map(item => (
              <span
                key={item}
                className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600">Completion</span>
          <span className="font-semibold text-slate-900">
            {completion.percentage}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>

        {completion.missing.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              Missing fields
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {completion.missing.slice(0, 7).map(item => (
                <span
                  key={item}
                  className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="max-w-[180px] text-right text-xs font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

function StickySaveBar({
  submitting,
  hasUnsavedChanges,
  completion,
  onSave,
  onCancel
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Save Travel Agent Profile
            </p>

            {hasUnsavedChanges ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                Unsaved changes
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                No changes
              </span>
            )}

            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
              {completion.percentage}% complete
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Category, payment terms, bank details and KYC will be saved in this travel agent profile.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}

            {submitting ? "Saving..." : "Save Travel Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200  p-5 ">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-1/3 rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-10 rounded-xl bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}