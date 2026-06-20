"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp
} from "firebase/firestore";

import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileText,
  Globe2,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  WalletCards,
  XCircle,
  AlertTriangle,
  MessageCircle,
  Landmark,
  ReceiptText
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import VendorForm from "@/components/vendors/VendorForm";
import VendorStatusChip from "@/components/vendors/VendorStatusChip";
import { saveVendor } from "@/lib/saveVendor";

import {
  getPaymentStatusMeta,
  getVendorDocumentTypeLabel,
  getVendorTypeLabel,
  VENDOR_STATUS
} from "@/lib/vendorConstants";

/* =========================
   HELPERS
========================= */

function safeText(value = "") {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}

function getLocation(vendor) {
  const parts = [
    vendor?.postOfficeName,
    vendor?.city || vendor?.district,
    vendor?.state,
    vendor?.country
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "No location added";
}

function getAddress(vendor) {
  const address = vendor?.address || {};

  const parts = [
    vendor?.addressLine1 || address.line1,
    vendor?.addressLine2 || address.line2,
    vendor?.postOfficeName || address.postOfficeName,
    vendor?.city || vendor?.district || address.city || address.district,
    vendor?.state || address.state,
    vendor?.country || address.country,
    vendor?.pincode || address.pincode
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "No address added";
}

function getBankValue(vendor, key) {
  return vendor?.[key] || vendor?.bankDetails?.[key] || "";
}

function sortByCreatedAtDesc(a, b) {
  const aTime = a.createdAt?.toDate
    ? a.createdAt.toDate().getTime()
    : new Date(a.createdAt || 0).getTime();

  const bTime = b.createdAt?.toDate
    ? b.createdAt.toDate().getTime()
    : new Date(b.createdAt || 0).getTime();

  return bTime - aTime;
}

function getWebsiteUrl(value = "") {
  const url = safeText(value);

  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

function getWhatsAppUrl(value = "") {
  const digits = safeText(value).replace(/\D/g, "");

  if (!digits) return "";

  return `https://wa.me/${digits}`;
}

function getProfileCompletion(vendor = {}) {
  const checks = [
    vendor.vendorName,
    vendor.vendorType,
    vendor.status,
    vendor.contactPerson,
    vendor.mobile || vendor.whatsapp || vendor.email,
    vendor.country,
    vendor.city || vendor.district,
    Array.isArray(vendor.destinations) && vendor.destinations.length > 0,
    Array.isArray(vendor.services) && vendor.services.length > 0,
    vendor.paymentTerms,
    vendor.bankName || vendor.bankDetails?.bankName
  ];

  const completed = checks.filter(Boolean).length;

  return Math.round((completed / checks.length) * 100);
}

function getCompletionTone(score) {
  if (score >= 80) return "green";
  if (score >= 50) return "amber";
  return "red";
}

/* =========================
   SMALL UI
========================= */

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded-xl w-64" />
        <div className="h-56 bg-gray-200 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
        </div>
        <div className="h-96 bg-gray-200 rounded-2xl" />
      </div>
    </main>
  );
}

function InfoCard({ icon: Icon, title, description, children, action }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100  overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Icon size={19} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {title}
            </h3>

            {description && (
              <p className="text-xs text-gray-500 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailItem({ label, value, icon: Icon, className = "" }) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-gray-50/60 p-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        {Icon && <Icon size={14} />}
        {label}
      </div>

      <p className="text-sm font-medium text-gray-900 mt-1 break-words">
        {value || "—"}
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subText, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700"
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100  p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>

          <h3 className="text-2xl font-semibold text-gray-900 mt-1">
            {value}
          </h3>

          {subText && (
            <p className="text-xs text-gray-400 mt-1">
              {subText}
            </p>
          )}
        </div>

        <div
          className={`
            h-11 w-11 rounded-xl flex items-center justify-center
            ${toneMap[tone] || toneMap.blue}
          `}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function EmptyBlock({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
      <div className="h-12 w-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center mx-auto text-gray-400">
        <ClipboardList size={22} />
      </div>

      <h4 className="text-sm font-semibold text-gray-900 mt-3">
        {title}
      </h4>

      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        {description}
      </p>

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function TabButton({ active, children, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-2 rounded-xl text-sm font-medium transition inline-flex items-center gap-2
        ${
          active
            ? "bg-blue-600 text-white "
            : "text-gray-600 hover:bg-gray-100"
        }
      `}
    >
      {children}

      {count !== undefined && (
        <span
          className={`
            text-[11px] px-1.5 py-0.5 rounded-full
            ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function CompletionCard({ score }) {
  const tone = getCompletionTone(score);

  const toneMap = {
    green: "bg-green-50 text-green-700 border-green-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100"
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">
            Profile Completion
          </p>

          <p className="text-2xl font-semibold mt-1">
            {score}%
          </p>
        </div>

        <ShieldCheck size={24} />
      </div>

      <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
        <div
          className="h-full rounded-full bg-current"
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-xs mt-2 opacity-80">
        Complete contact, location, services, payment terms and bank details.
      </p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, disabled = false }) {
  if (disabled || !href) {
    return (
      <span
        className="
          inline-flex items-center gap-2 px-3 py-2 rounded-xl
          border border-gray-200 bg-white text-gray-300 text-xs font-semibold
          cursor-not-allowed
        "
      >
        <Icon size={14} />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="
        inline-flex items-center gap-2 px-3 py-2 rounded-xl
        border border-gray-200 bg-white text-gray-700 text-xs font-semibold
        hover:bg-gray-50
      "
    >
      <Icon size={14} />
      {label}
    </a>
  );
}

/* =========================
   MAIN PAGE
========================= */

export default function VendorDetailPage() {
  const { vendorId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(true);

  const [vendor, setVendor] = useState(null);
  const [vendorLoading, setVendorLoading] = useState(true);

  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user || !vendorId) return;

    setVendorLoading(true);

    const vendorRef = doc(db, "vendors", vendorId);

    const unsub = onSnapshot(
      vendorRef,
      snapshot => {
        if (!snapshot.exists()) {
          setVendor(null);
          setVendorLoading(false);
          return;
        }

        setVendor({
          id: snapshot.id,
          vendorId: snapshot.id,
          ...snapshot.data()
        });

        setVendorLoading(false);
      },
      err => {
        console.error("Vendor load failed:", err);
        setError(err?.message || "Failed to load vendor.");
        setVendorLoading(false);
      }
    );

    return () => unsub();
  }, [authLoading, user, vendorId]);

  useEffect(() => {
    if (authLoading || !user || !vendorId) return;

    const q = query(
      collection(db, "vendor_documents"),
      where("vendorId", "==", vendorId)
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort(sortByCreatedAtDesc);

        setDocuments(rows);
      },
      err => {
        console.error("Vendor documents load failed:", err);
      }
    );

    return () => unsub();
  }, [authLoading, user, vendorId]);

  useEffect(() => {
    if (authLoading || !user || !vendorId) return;

    const q = query(
      collection(db, "leadVendorPayments"),
      where("vendorId", "==", vendorId)
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort(sortByCreatedAtDesc);

        setPayments(rows);
      },
      err => {
        console.error("Vendor payments load failed:", err);
      }
    );

    return () => unsub();
  }, [authLoading, user, vendorId]);

  const stats = useMemo(() => {
    const totalPaid = payments.reduce((sum, item) => {
      return sum + Number(item.amount || item.paidAmount || 0);
    }, 0);

    const pendingPayments = payments.filter(item => {
      return ["pending", "partial", "overdue"].includes(
        item.paymentStatus || item.status
      );
    });

    return {
      documents: documents.length,
      payments: payments.length,
      totalPaid,
      pendingPayments: pendingPayments.length
    };
  }, [documents, payments]);

  const destinationText = useMemo(() => {
    const values = vendor?.destinations || vendor?.destinationNames || [];

    if (!Array.isArray(values) || values.length === 0) {
      return "No destination mapped";
    }

    return values.join(", ");
  }, [vendor]);

  const serviceText = useMemo(() => {
    const values = vendor?.services || [];

    if (!Array.isArray(values) || values.length === 0) {
      return "No services added";
    }

    return values.join(", ");
  }, [vendor]);

  const profileCompletion = useMemo(() => {
    return getProfileCompletion(vendor || {});
  }, [vendor]);

  const handleSave = async formPayload => {
    if (!vendor?.id) return;

    setSaving(true);
    setError("");

    try {
      await saveVendor({
        vendorId: vendor.id,
        form: formPayload,
        user
      });

      setEditMode(false);
    } catch (err) {
      console.error("Vendor update failed:", err);
      setError(err?.message || "Failed to update vendor.");
    } finally {
      setSaving(false);
    }
  };

  const updateVendorStatus = async nextStatus => {
    if (!vendor?.id || actionLoading) return;

    const label =
      nextStatus === VENDOR_STATUS.INACTIVE
        ? "mark this vendor inactive"
        : nextStatus === VENDOR_STATUS.ACTIVE
          ? "mark this vendor active"
          : "update this vendor";

    const confirmed = window.confirm(`Are you sure you want to ${label}?`);

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      await updateDoc(doc(db, "vendors", vendor.id), {
        status: nextStatus,
        updatedByUid: user?.uid || user?.id || user?.email || "",
        updatedByName:
          user?.name ||
          user?.displayName ||
          user?.fullName ||
          user?.email ||
          "System",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Vendor status update failed:", err);
      setError(err?.message || "Failed to update vendor status.");
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || vendorLoading) {
    return <PageSkeleton />;
  }

  if (!vendor) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="mt-6 bg-white rounded-2xl border border-gray-100  p-10 text-center">
            <XCircle size={42} className="text-red-500 mx-auto" />

            <h1 className="text-xl font-semibold text-gray-900 mt-4">
              Vendor not found
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              This vendor may have been removed or the link is invalid.
            </p>

            <Link
              href="/admin/vendors"
              className="mt-5 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Go to Vendors
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (editMode) {
    return (
      <main className="min-h-screen p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-5">
          <button
            type="button"
            onClick={() => setEditMode(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-60"
          >
            <ArrowLeft size={16} />
            Back to vendor profile
          </button>

          <VendorForm
            initialData={vendor}
            saving={saving}
            error={error}
            onSubmit={handleSave}
            onCancel={() => setEditMode(false)}
          />
        </div>
      </main>
    );
  }

  const websiteUrl = getWebsiteUrl(vendor.website);
  const whatsappUrl = getWhatsAppUrl(vendor.whatsapp || vendor.mobile);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-9xl mx-auto space-y-6">
        {/* TOP NAV */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <Link
            href="/admin/vendors"
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Vendor List
          </Link>
        </div>

        {/* HERO */}
        <section className="bg-white rounded-3xl border border-gray-100  overflow-hidden">
          <div className="p-5 md:p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-16 w-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 ">
                  <Building2 size={29} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 truncate">
                      {vendor.vendorName || "Unnamed Vendor"}
                    </h1>

                    <VendorStatusChip type="vendor" value={vendor.status} />

                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600">
                      {vendor.vendorLocationType === "international"
                        ? "International"
                        : "Indian Vendor"}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mt-1">
                    {vendor.vendorCode || "No code"} ·{" "}
                    {getVendorTypeLabel(vendor.vendorType)}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound size={15} />
                      {vendor.contactPerson || "No contact"}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} />
                      {getLocation(vendor)}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={15} />
                      Created {formatDate(vendor.createdAt)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <QuickAction
                      href={vendor.mobile ? `tel:${vendor.mobile}` : ""}
                      icon={Phone}
                      label="Call"
                      disabled={!vendor.mobile}
                    />

                    <QuickAction
                      href={vendor.email ? `mailto:${vendor.email}` : ""}
                      icon={Mail}
                      label="Email"
                      disabled={!vendor.email}
                    />

                    <QuickAction
                      href={whatsappUrl}
                      icon={MessageCircle}
                      label="WhatsApp"
                      disabled={!whatsappUrl}
                    />

                    <QuickAction
                      href={websiteUrl}
                      icon={ExternalLink}
                      label="Website"
                      disabled={!websiteUrl}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row xl:flex-col gap-3 xl:min-w-[220px]">
                {vendor.status !== VENDOR_STATUS.ACTIVE && (
                  <button
                    type="button"
                    onClick={() => updateVendorStatus(VENDOR_STATUS.ACTIVE)}
                    disabled={actionLoading}
                    className="
                      inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                      bg-green-600 text-white text-sm font-medium
                      hover:bg-green-700 disabled:opacity-60
                    "
                  >
                    <CheckCircle2 size={16} />
                    Mark Active
                  </button>
                )}

                {vendor.status === VENDOR_STATUS.ACTIVE && (
                  <button
                    type="button"
                    onClick={() => updateVendorStatus(VENDOR_STATUS.INACTIVE)}
                    disabled={actionLoading}
                    className="
                      inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                      border border-gray-200 bg-white text-gray-700 text-sm font-medium
                      hover:bg-gray-50 disabled:opacity-60
                    "
                  >
                    <XCircle size={16} />
                    Mark Inactive
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="
                    inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    bg-blue-600 text-white text-sm font-medium
                    hover:bg-blue-700
                  "
                >
                  <Edit3 size={16} />
                  Edit Vendor
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </section>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <CompletionCard score={profileCompletion} />

          <StatCard
            icon={Globe2}
            label="Destinations"
            value={
              Array.isArray(vendor.destinations)
                ? vendor.destinations.length
                : 0
            }
            subText="Mapped destination count"
            tone="blue"
          />

          <StatCard
            icon={FileText}
            label="Documents"
            value={stats.documents}
            subText="Uploaded vendor files"
            tone="amber"
          />

          <StatCard
            icon={WalletCards}
            label="Payments"
            value={stats.payments}
            subText={`${stats.pendingPayments} pending/partial`}
            tone="green"
          />

          <StatCard
            icon={IndianRupee}
            label="Total Paid"
            value={formatMoney(stats.totalPaid)}
            subText="From vendor ledger"
            tone="gray"
          />
        </div>

        {/* STICKY TABS */}
        <div className="sticky top-20 z-20">
          <div className="bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-md p-2 flex flex-wrap items-center gap-2">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </TabButton>

            <TabButton
              active={activeTab === "commercials"}
              onClick={() => setActiveTab("commercials")}
            >
              Commercials
            </TabButton>

            <TabButton
              active={activeTab === "documents"}
              onClick={() => setActiveTab("documents")}
              count={documents.length}
            >
              Documents
            </TabButton>

            <TabButton
              active={activeTab === "ledger"}
              onClick={() => setActiveTab("ledger")}
              count={payments.length}
            >
              Ledger
            </TabButton>
          </div>
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <InfoCard
                icon={Building2}
                title="Vendor Profile"
                description="Core vendor identity, type, destinations and mapped services."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DetailItem
                    label="Vendor Name"
                    value={vendor.vendorName}
                    icon={Building2}
                  />

                  <DetailItem
                    label="Vendor Code"
                    value={vendor.vendorCode}
                    icon={ShieldCheck}
                  />

                  <DetailItem
                    label="Vendor Type"
                    value={getVendorTypeLabel(vendor.vendorType)}
                    icon={ClipboardList}
                  />

                  <DetailItem
                    label="Status"
                    value={vendor.status}
                    icon={CheckCircle2}
                  />

                  <DetailItem
                    label="Destinations"
                    value={destinationText}
                    icon={Globe2}
                    className="md:col-span-2"
                  />

                  <DetailItem
                    label="Services"
                    value={serviceText}
                    icon={ClipboardList}
                    className="md:col-span-2"
                  />
                </div>
              </InfoCard>

              <InfoCard
                icon={MapPin}
                title="Address & Location"
                description="Vendor office address and local/international mapping."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DetailItem
                    label="Location Type"
                    value={
                      vendor.vendorLocationType === "international"
                        ? "International Vendor"
                        : "Indian Vendor"
                    }
                    icon={Globe2}
                  />

                  <DetailItem
                    label="Full Address"
                    value={getAddress(vendor)}
                    icon={MapPin}
                  />

                  <DetailItem
                    label="Post Office / Locality"
                    value={vendor.postOfficeName}
                    icon={MapPin}
                  />

                  <DetailItem
                    label="City / District"
                    value={vendor.city || vendor.district}
                    icon={MapPin}
                  />

                  <DetailItem
                    label="State / Province"
                    value={vendor.state}
                    icon={MapPin}
                  />

                  <DetailItem
                    label="Country"
                    value={vendor.country}
                    icon={Globe2}
                  />

                  <DetailItem
                    label={
                      vendor.vendorLocationType === "international"
                        ? "Postal / ZIP Code"
                        : "Pincode"
                    }
                    value={vendor.pincode}
                    icon={MapPin}
                  />
                </div>
              </InfoCard>
            </div>

            <div className="space-y-4">
              <InfoCard
                icon={Phone}
                title="Contact Details"
                description="Primary vendor SPOC and communication details."
              >
                <div className="space-y-3">
                  <DetailItem
                    label="Contact Person"
                    value={vendor.contactPerson}
                    icon={UserRound}
                  />

                  <DetailItem
                    label="Designation"
                    value={vendor.designation}
                    icon={ShieldCheck}
                  />

                  <DetailItem
                    label="Mobile"
                    value={vendor.mobile}
                    icon={Phone}
                  />

                  <DetailItem
                    label="WhatsApp"
                    value={vendor.whatsapp}
                    icon={MessageCircle}
                  />

                  <DetailItem
                    label="Email"
                    value={vendor.email}
                    icon={Mail}
                  />

                  <DetailItem
                    label="Website"
                    value={vendor.website}
                    icon={ExternalLink}
                  />
                </div>
              </InfoCard>

              <InfoCard
                icon={CalendarDays}
                title="Audit Details"
                description="Creation and latest update information."
              >
                <div className="space-y-3">
                  <DetailItem
                    label="Created By"
                    value={vendor.createdByName}
                    icon={UserRound}
                  />

                  <DetailItem
                    label="Created At"
                    value={formatDateTime(vendor.createdAt)}
                    icon={CalendarDays}
                  />

                  <DetailItem
                    label="Updated By"
                    value={vendor.updatedByName}
                    icon={UserRound}
                  />

                  <DetailItem
                    label="Updated At"
                    value={formatDateTime(vendor.updatedAt)}
                    icon={CalendarDays}
                  />
                </div>
              </InfoCard>
            </div>
          </div>
        )}

        {/* COMMERCIALS */}
        {activeTab === "commercials" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoCard
              icon={ReceiptText}
              title="Tax & Payment Terms"
              description="GST/PAN and commercial terms used in booking and payment workflows."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DetailItem
                  label="GST Number"
                  value={vendor.gstNumber}
                  icon={FileText}
                />

                <DetailItem
                  label="PAN Number"
                  value={vendor.panNumber}
                  icon={FileText}
                />

                <DetailItem
                  label="Payment Terms"
                  value={vendor.paymentTerms}
                  icon={WalletCards}
                />

                <DetailItem
                  label="Credit Days"
                  value={
                    vendor.creditDays === 0 || vendor.creditDays
                      ? `${vendor.creditDays} days`
                      : "—"
                  }
                  icon={CalendarDays}
                />

                <DetailItem
                  label="Cancellation Policy"
                  value={vendor.cancellationPolicy}
                  icon={FileText}
                  className="md:col-span-2"
                />

                <DetailItem
                  label="Internal Notes"
                  value={vendor.notes}
                  icon={ClipboardList}
                  className="md:col-span-2"
                />
              </div>
            </InfoCard>

            <InfoCard
              icon={Landmark}
              title="Bank Details"
              description="Bank and UPI details for vendor payouts."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DetailItem
                  label="Bank Name"
                  value={getBankValue(vendor, "bankName")}
                  icon={Banknote}
                />

                <DetailItem
                  label="Account Holder"
                  value={getBankValue(vendor, "accountName")}
                  icon={UserRound}
                />

                <DetailItem
                  label="Account Number"
                  value={getBankValue(vendor, "accountNumber")}
                  icon={Banknote}
                />

                <DetailItem
                  label="Branch Name"
                  value={getBankValue(vendor, "branchName")}
                  icon={MapPin}
                />

                <DetailItem
                  label="IFSC Code"
                  value={
                    vendor.ifscCode ||
                    vendor.ifsc ||
                    vendor.bankDetails?.ifscCode ||
                    vendor.bankDetails?.ifsc
                  }
                  icon={ShieldCheck}
                />

                <DetailItem
                  label="UPI ID"
                  value={getBankValue(vendor, "upiId")}
                  icon={WalletCards}
                />
              </div>
            </InfoCard>

            {vendor.status === VENDOR_STATUS.BLACKLISTED && (
              <div className="lg:col-span-2">
                <InfoCard
                  icon={AlertTriangle}
                  title="Blacklist Details"
                  description="Reason and internal warning for this vendor."
                >
                  <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
                    <p className="text-xs font-semibold text-red-700">
                      Blacklist Reason
                    </p>

                    <p className="text-sm text-red-700 mt-1">
                      {vendor.blacklistedReason || "No reason added."}
                    </p>
                  </div>
                </InfoCard>
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS */}
        {activeTab === "documents" && (
          <InfoCard
            icon={FileText}
            title="Vendor Documents"
            description="Agreement, GST certificate, PAN card, bank proof and rate contracts."
            action={
              <Link
                href={`/admin/vendors/${vendor.id}/documents`}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Manage Documents
                <ExternalLink size={14} />
              </Link>
            }
          >
            {documents.length === 0 ? (
              <EmptyBlock
                title="No documents uploaded"
                description="Upload vendor agreements, GST certificate, PAN card, bank proof or rate contracts from the documents section."
                action={
                  <Link
                    href={`/admin/vendors/${vendor.id}/documents`}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Manage Documents
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {documents.map(item => (
                  <div
                    key={item.id}
                    className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {item.documentName ||
                          item.fileName ||
                          getVendorDocumentTypeLabel(item.documentType)}
                      </p>

                      <p className="text-xs text-gray-500 mt-0.5">
                        {getVendorDocumentTypeLabel(item.documentType)} ·{" "}
                        Uploaded {formatDate(item.createdAt)}
                      </p>
                    </div>

                    {item.fileUrl && (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                      >
                        View File
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </InfoCard>
        )}

        {/* LEDGER */}
        {activeTab === "ledger" && (
          <InfoCard
            icon={WalletCards}
            title="Vendor Payment Ledger"
            description="Payments made to this vendor from lead/vendor payment module."
          >
            {payments.length === 0 ? (
              <EmptyBlock
                title="No vendor payments found"
                description="Payments made to this vendor will appear here once the payment module records vendor payouts."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                      <th className="py-3 pr-4 font-semibold">Date</th>
                      <th className="py-3 pr-4 font-semibold">Lead</th>
                      <th className="py-3 pr-4 font-semibold">Mode</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold text-right">
                        Amount
                      </th>
                      <th className="py-3 pr-4 font-semibold">Reference</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {payments.map(item => {
                      const statusMeta = getPaymentStatusMeta(
                        item.paymentStatus || item.status
                      );

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/70">
                          <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">
                            {formatDate(item.paidAt || item.createdAt)}
                          </td>

                          <td className="py-3 pr-4 text-gray-700">
                            {item.leadCode || item.leadId || "—"}
                          </td>

                          <td className="py-3 pr-4 text-gray-700 capitalize">
                            {safeText(item.paymentMode).replaceAll("_", " ") ||
                              "—"}
                          </td>

                          <td className="py-3 pr-4">
                            <span
                              className={`
                                inline-flex px-2.5 py-1 rounded-full text-xs font-medium
                                ${
                                  statusMeta.tone === "green"
                                    ? "bg-green-50 text-green-700"
                                    : statusMeta.tone === "blue"
                                      ? "bg-blue-50 text-blue-700"
                                      : statusMeta.tone === "red"
                                        ? "bg-red-50 text-red-700"
                                        : "bg-amber-50 text-amber-700"
                                }
                              `}
                            >
                              {statusMeta.label}
                            </span>
                          </td>

                          <td className="py-3 pr-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatMoney(item.amount || item.paidAmount)}
                          </td>

                          <td className="py-3 pr-4 text-gray-500">
                            {item.transactionRef || item.referenceNo || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </InfoCard>
        )}
      </div>
    </main>
  );
}