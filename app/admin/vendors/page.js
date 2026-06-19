"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import {
  Building2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import VendorForm from "@/components/vendors/VendorForm";
import VendorStatusChip from "@/components/vendors/VendorStatusChip";

import { saveVendor } from "@/lib/saveVendor";

import {
  VENDOR_STATUS_OPTIONS,
  VENDOR_TYPE_OPTIONS,
  getVendorTypeLabel
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

function getDestinationText(vendor) {
  const destinations =
    vendor.destinations ||
    vendor.destinationNames ||
    [];

  if (!Array.isArray(destinations) || destinations.length === 0) {
    return "No destination mapped";
  }

  return destinations.join(", ");
}

function getSearchBlob(vendor) {
  return [
    vendor.vendorName,
    vendor.vendorCode,
    vendor.vendorType,
    vendor.status,
    vendor.contactPerson,
    vendor.email,
    vendor.mobile,
    vendor.whatsapp,
    vendor.city,
    vendor.state,
    vendor.country,
    ...(vendor.destinations || []),
    ...(vendor.destinationNames || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/* =========================
   SMALL UI
========================= */

function StatCard({ icon: Icon, label, value, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700"
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <h3 className="text-2xl font-semibold text-gray-900 mt-1">
            {value}
          </h3>
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

function EmptyVendors({ onAdd }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
        <Building2 size={25} />
      </div>

      <h3 className="text-base font-semibold text-gray-900 mt-4">
        No vendors found
      </h3>

      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Add your DMC, hotel, transport, visa, activity and other travel partners
        here.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="
          mt-5 inline-flex items-center gap-2
          px-4 py-2 rounded-xl bg-blue-600 text-white
          text-sm font-medium hover:bg-blue-700
        "
      >
        <Plus size={16} />
        Add Vendor
      </button>
    </div>
  );
}

function VendorCard({ vendor, onEdit }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {vendor.vendorName || "Unnamed Vendor"}
            </h3>

            <VendorStatusChip type="vendor" value={vendor.status} />
          </div>

          <p className="text-xs text-gray-500 mt-1">
            {vendor.vendorCode || "No code"} ·{" "}
            {getVendorTypeLabel(vendor.vendorType)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onEdit(vendor)}
          className="
            h-9 w-9 rounded-xl border border-gray-200
            flex items-center justify-center text-gray-500
            hover:bg-gray-50 hover:text-gray-900
          "
          title="Edit vendor"
        >
          <Edit3 size={15} />
        </button>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Users size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {vendor.contactPerson || "No contact person"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <Phone size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {vendor.mobile || vendor.whatsapp || "No phone added"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <Mail size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {vendor.email || "No email added"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <MapPin size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {safeText(vendor.city) ||
              safeText(vendor.country) ||
              "No location added"}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 mb-2">
          Destinations
        </p>

        <p className="text-sm text-gray-700 line-clamp-2">
          {getDestinationText(vendor)}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>Created {formatDate(vendor.createdAt)}</span>
        <span>{vendor.createdByName || "—"}</span>
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */

export default function AdminVendorsPage() {
  const { user, loading: authLoading } = useAuth(true);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all"
  });

  /* =========================
     LOAD VENDORS
  ========================== */

  useEffect(() => {
    if (authLoading || !user) return;

    setLoading(true);

    const q = query(
      collection(db, "vendors"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          vendorId: docSnap.id,
          ...docSnap.data()
        }));

        setVendors(rows);
        setLoading(false);
      },
      err => {
        console.error("Vendor load failed:", err);
        setError(err?.message || "Failed to load vendors.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authLoading, user]);

  /* =========================
     DERIVED DATA
  ========================== */

  const stats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter(v => v.status === "active").length;
    const inactive = vendors.filter(v => v.status === "inactive").length;
    const blacklisted = vendors.filter(v => v.status === "blacklisted").length;

    return {
      total,
      active,
      inactive,
      blacklisted
    };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return vendors.filter(vendor => {
      const matchesSearch =
        !search || getSearchBlob(vendor).includes(search);

      const matchesType =
        filters.type === "all" || vendor.vendorType === filters.type;

      const matchesStatus =
        filters.status === "all" || vendor.status === filters.status;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [vendors, filters]);

  /* =========================
     ACTIONS
  ========================== */

  const openCreateForm = () => {
    setEditingVendor(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = vendor => {
    setEditingVendor(vendor);
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    if (saving) return;

    setEditingVendor(null);
    setShowForm(false);
    setError("");
  };

  const handleSubmit = async formPayload => {
    setSaving(true);
    setError("");

    try {
      await saveVendor({
        vendorId: editingVendor?.id || "",
        form: formPayload,
        user
      });

      setEditingVendor(null);
      setShowForm(false);
    } catch (err) {
      console.error("Vendor save failed:", err);
      setError(err?.message || "Failed to save vendor.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl w-72" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(item => (
              <div
                key={item}
                className="h-28 bg-gray-200 rounded-2xl"
              />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
              <ShieldCheck size={16} />
              Vendor Management
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mt-1">
              Vendors
            </h1>

            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Manage DMCs, hotels, transport partners, activity vendors and
              other suppliers used for lead quotations.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="
              inline-flex items-center justify-center gap-2
              px-4 py-2.5 rounded-xl bg-blue-600 text-white
              text-sm font-medium hover:bg-blue-700
              shadow-sm
            "
          >
            <Plus size={17} />
            Add Vendor
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Building2}
            label="Total Vendors"
            value={stats.total}
            tone="blue"
          />
          <StatCard
            icon={ShieldCheck}
            label="Active"
            value={stats.active}
            tone="green"
          />
          <StatCard
            icon={Users}
            label="Inactive"
            value={stats.inactive}
            tone="gray"
          />
          <StatCard
            icon={X}
            label="Blacklisted"
            value={stats.blacklisted}
            tone="red"
          />
        </div>

        {/* FORM */}
        {showForm && (
          <VendorForm
            initialData={editingVendor}
            saving={saving}
            error={error}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        )}

        {/* FILTERS */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={filters.search}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    search: e.target.value
                  }))
                }
                placeholder="Search vendor, code, destination, contact..."
                className="
                  w-full rounded-xl border border-gray-200
                  pl-10 pr-3 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                "
              />
            </div>

            <select
              value={filters.type}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  type: e.target.value
                }))
              }
              className="
                rounded-xl border border-gray-200
                px-3 py-2.5 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            >
              <option value="all">All Vendor Types</option>
              {VENDOR_TYPE_OPTIONS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  status: e.target.value
                }))
              }
              className="
                rounded-xl border border-gray-200
                px-3 py-2.5 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            >
              <option value="all">All Status</option>
              {VENDOR_STATUS_OPTIONS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LIST */}
        {filteredVendors.length === 0 ? (
          <EmptyVendors onAdd={openCreateForm} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onEdit={openEditForm}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}