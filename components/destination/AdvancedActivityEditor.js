"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  Plus,
  Trash2,
  Copy,
  Clock,
  IndianRupee,
  RefreshCw,
  ImageIcon,
  Youtube,
  AlertCircle,
  Star,
  Tag,
  Building2,
  X,
  Edit3,
  CheckCircle2,
  Info,
  Users,
  Settings2
} from "lucide-react";

import { db } from "@/lib/firebase";
import MediaUploader from "@/components/destination/MediaUploader";

import {
  ACTIVITY_TYPES,
  PRICE_UNITS,
  MARKUP_TYPES,
  OPERATING_DAYS,
  SUPPORTED_CURRENCIES
} from "@/lib/destinationConstants";

import { createEmptyActivity } from "@/lib/destinationSchema";

import {
  calculateActivityPricing,
  roundMoney
} from "@/lib/destinationPricing";

import {
  createYouTubeMediaItem,
  normalizeMediaGallery,
  extractYouTubeId
} from "@/lib/destinationMediaUtils";

/* =========================
   GENERAL HELPERS
========================= */

function createId(prefix = "id") {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatInr(value) {
  const amount = toNumber(value);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function getCurrencySymbol(currency) {
  return (
    SUPPORTED_CURRENCIES.find(item => item.value === currency)?.symbol ||
    currency ||
    ""
  );
}

function getLabel(options, value) {
  return options.find(item => item.value === value)?.label || value || "-";
}

function getAgeLabel(passenger) {
  if (!passenger) return "-";

  if (passenger.maxAge === null || passenger.maxAge === undefined) {
    return `${passenger.minAge || 0}+ yrs`;
  }

  return `${passenger.minAge || 0}-${passenger.maxAge} yrs`;
}

function getSellingValue(pricing, key) {
  return (
    pricing?.[key]?.sellingInInr ||
    pricing?.[`selling${key.charAt(0).toUpperCase()}${key.slice(1)}InInr`] ||
    0
  );
}

/* =========================
   VENDOR HELPERS
========================= */

function getVendorDisplayName(vendor) {
  return (
    vendor.vendorName ||
    vendor.name ||
    vendor.companyName ||
    vendor.agencyName ||
    vendor.displayName ||
    "Unnamed Vendor"
  );
}

function normalizeVendor(docSnap) {
  const data = docSnap.data() || {};
  const vendorName = getVendorDisplayName(data);

  return {
    id: docSnap.id,
    vendorId: docSnap.id,

    vendorName,
    name: vendorName,

    contactPerson:
      data.contactPerson ||
      data.primaryContactName ||
      data.spocName ||
      data.contactName ||
      "",

    phone:
      data.phone ||
      data.mobile ||
      data.contactNumber ||
      data.primaryPhone ||
      data.whatsapp ||
      "",

    email:
      data.email ||
      data.primaryEmail ||
      data.contactEmail ||
      data.workEmail ||
      "",

    vendorCurrency:
      data.currency ||
      data.vendorCurrency ||
      data.defaultCurrency ||
      "",

    paymentTerms:
      data.paymentTerms ||
      data.defaultPaymentTerms ||
      "",

    cancellationPolicy:
      data.cancellationPolicy ||
      data.defaultCancellationPolicy ||
      "",

    serviceType:
      data.serviceType ||
      data.vendorType ||
      data.category ||
      data.type ||
      "",

    active: data.active ?? true
  };
}

/* =========================
   ACTIVITY NORMALIZATION
========================= */

function normalizeActivityItem(item = {}, index = 0) {
  const empty = createEmptyActivity();

  const legacyImageMedia = item.image
    ? [
        {
          id: createId("media"),
          type: "image",
          source: "upload",
          url:
            typeof item.image === "string"
              ? item.image
              : item.image?.url || "",
          thumbnailUrl:
            typeof item.image === "string"
              ? item.image
              : item.image?.thumbnailUrl || item.image?.url || "",
          title: item.title || "",
          caption: "",
          altText: item.title || "",
          order: 1,
          featured: true,
          active: true
        }
      ]
    : [];

  const media = normalizeMediaGallery(
    Array.isArray(item.media) && item.media.length
      ? item.media
      : legacyImageMedia
  );

  return {
    ...empty,
    ...item,

    id: item.id || empty.id,
    title: item.title || item.name || "",
    description: item.description || "",
    activityType: item.activityType || empty.activityType,

    media,
    mediaUploads: Array.isArray(item.mediaUploads) ? item.mediaUploads : [],

    timing: {
      ...empty.timing,
      ...(item.timing || {}),
      operatingDays: Array.isArray(item.timing?.operatingDays)
        ? item.timing.operatingDays
        : empty.timing.operatingDays,
      blackoutDates: Array.isArray(item.timing?.blackoutDates)
        ? item.timing.blackoutDates
        : []
    },

    pricing: calculateActivityPricing({
      ...empty.pricing,
      ...(item.pricing || {}),
      adult: {
        ...empty.pricing.adult,
        ...(item.pricing?.adult || {})
      },
      child: {
        ...empty.pricing.child,
        ...(item.pricing?.child || {})
      },
      infant: {
        ...empty.pricing.infant,
        ...(item.pricing?.infant || {})
      }
    }),

    vendor: {
      ...empty.vendor,
      ...(item.vendor || {})
    },

    inclusions: Array.isArray(item.inclusions) ? item.inclusions : [],
    exclusions: Array.isArray(item.exclusions) ? item.exclusions : [],

    cancellationPolicy: item.cancellationPolicy || "",
    internalNotes: item.internalNotes || "",

    featured: Boolean(item.featured),
    active: item.active ?? true,
    order: Number(item.order || index + 1)
  };
}

function normalizeActivityList(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .filter(Boolean)
    .map((item, index) => normalizeActivityItem(item, index))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((item, index) => ({
      ...item,
      order: index + 1
    }));
}

function reorderItems(items = [], fromIndex, toIndex) {
  const copy = [...items];

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= copy.length ||
    toIndex >= copy.length
  ) {
    return copy;
  }

  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);

  return copy.map((item, index) => ({
    ...item,
    order: index + 1
  }));
}

/* =========================
   MAIN COMPONENT
========================= */

export default function AdvancedActivityEditor({
  title = "Activities",
  items = [],
  basePath = "destinations/activities",
  onChange
}) {
  const activities = useMemo(() => normalizeActivityList(items), [items]);

  const [editingId, setEditingId] = useState("");
  const [activeTab, setActiveTab] = useState("quick");
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const editingActivity = useMemo(
    () => activities.find(item => item.id === editingId),
    [activities, editingId]
  );

  useEffect(() => {
    const loadVendors = async () => {
      try {
        setLoadingVendors(true);

        const snap = await getDocs(collection(db, "vendors"));

        const list = snap.docs
          .map(normalizeVendor)
          .filter(vendor => vendor.active !== false)
          .sort((a, b) =>
            String(a.vendorName || "").localeCompare(
              String(b.vendorName || "")
            )
          );

        setVendors(list);
      } catch (error) {
        console.error("Unable to load vendors:", error);
        setVendors([]);
      } finally {
        setLoadingVendors(false);
      }
    };

    loadVendors();
  }, []);

  const emit = nextItems => {
    onChange?.(normalizeActivityList(nextItems));
  };

  const addActivity = () => {
    const activity = {
      ...createEmptyActivity(),
      id: createId("activity"),
      order: activities.length + 1
    };

    emit([...activities, activity]);
    setEditingId(activity.id);
    setActiveTab("quick");
  };

  const updateActivity = (activityId, patch) => {
    emit(
      activities.map(activity => {
        if (activity.id !== activityId) return activity;

        const next = {
          ...activity,
          ...patch
        };

        if (patch.pricing) {
          next.pricing = calculateActivityPricing(patch.pricing);
        }

        return next;
      })
    );
  };

  const deleteActivity = activityId => {
    const activity = activities.find(item => item.id === activityId);

    const confirmed = window.confirm(
      `Delete activity "${activity?.title || "Untitled Activity"}"?`
    );

    if (!confirmed) return;

    const next = activities.filter(item => item.id !== activityId);

    emit(
      next.map((item, index) => ({
        ...item,
        order: index + 1
      }))
    );

    if (editingId === activityId) {
      setEditingId("");
    }
  };

  const duplicateActivity = activityId => {
    const activity = activities.find(item => item.id === activityId);
    if (!activity) return;

    const copy = {
      ...JSON.parse(JSON.stringify(activity)),
      id: createId("activity"),
      title: `${activity.title || "Activity"} Copy`,
      order: activities.length + 1,
      featured: false
    };

    emit([...activities, copy]);
    setEditingId(copy.id);
    setActiveTab("quick");
  };

  const moveActivity = (index, direction) => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    emit(reorderItems(activities, index, nextIndex));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Simple activity cards with detailed costing inside edit drawer.
          </p>
        </div>

        <button
          type="button"
          onClick={addActivity}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Activity
        </button>
      </div>

      {!activities.length ? (
        <EmptyActivityState onAdd={addActivity} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {activities.map((activity, index) => (
            <ActivitySummaryCard
              key={activity.id}
              activity={activity}
              index={index}
              total={activities.length}
              onEdit={() => {
                setEditingId(activity.id);
                setActiveTab("quick");
              }}
              onDuplicate={() => duplicateActivity(activity.id)}
              onDelete={() => deleteActivity(activity.id)}
              onMove={direction => moveActivity(index, direction)}
            />
          ))}
        </div>
      )}

      {editingActivity && (
        <ActivityEditorDrawer
          activity={editingActivity}
          basePath={`${basePath}/${editingActivity.id}`}
          vendors={vendors}
          loadingVendors={loadingVendors}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => setEditingId("")}
          onUpdate={patch => updateActivity(editingActivity.id, patch)}
        />
      )}
    </div>
  );
}

/* =========================
   LIST UI
========================= */

function EmptyActivityState({ onAdd }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Clock size={22} />
      </div>

      <h3 className="text-base font-semibold text-slate-950">
        No activities added
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Add activity with vendor, adult/child rate, ROE, timing, and media.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700"
      >
        <Plus size={16} />
        Add Activity
      </button>
    </div>
  );
}

function ActivitySummaryCard({
  activity,
  index,
  total,
  onEdit,
  onDuplicate,
  onDelete,
  onMove
}) {
  const pricing = activity.pricing || {};
  const timing = activity.timing || {};
  const currency = pricing.currency || "USD";
  const symbol = getCurrencySymbol(currency);

  const adultAmount = pricing.adult?.amount || 0;
  const childAmount = pricing.child?.amount || 0;

  const adultSelling = getSellingValue(pricing, "adult");
  const childSelling = getSellingValue(pricing, "child");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4  transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-slate-950">
              {activity.title?.trim() || `Activity ${index + 1}`}
            </h4>

            {activity.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                <Star size={11} />
                Featured
              </span>
            )}

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                activity.active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {activity.active ? "Active" : "Inactive"}
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {getLabel(ACTIVITY_TYPES, activity.activityType)}
            {activity.vendor?.vendorName
              ? ` | ${activity.vendor.vendorName}`
              : " | Vendor not selected"}
            {currency ? ` | ${currency}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          <Edit3 size={14} />
          Edit
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryRateCard
          label="Adult"
          vendorRate={`${symbol}${adultAmount || 0}`}
          selling={formatInr(adultSelling)}
        />

        <SummaryRateCard
          label="Child"
          vendorRate={`${symbol}${childAmount || 0}`}
          selling={formatInr(childSelling)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-3 py-1.5">
          Duration: {timing.duration || "Not set"}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1.5">
          Pickup: {timing.pickupRequired ? "Yes" : "No"}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1.5">
          ROE: {pricing.finalRoeToInr || "-"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Up
          </button>

          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Down
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
          >
            <Copy size={13} />
            Duplicate
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRateCard({ label, vendorRate, selling }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">Vendor</span>
        <span className="font-semibold text-slate-900">{vendorRate}</span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">Selling</span>
        <span className="font-semibold text-emerald-700">{selling}</span>
      </div>
    </div>
  );
}

/* =========================
   DRAWER
========================= */

function ActivityEditorDrawer({
  activity,
  basePath,
  vendors,
  loadingVendors,
  activeTab,
  onTabChange,
  onClose,
  onUpdate
}) {
  const tabs = [
    { id: "quick", label: "Quick Setup", icon: CheckCircle2 },
    { id: "pricing", label: "Pricing", icon: IndianRupee },
    { id: "timing", label: "Timing", icon: Clock },
    { id: "vendor", label: "Vendor", icon: Building2 },
    { id: "media", label: "Media", icon: ImageIcon },
    { id: "more", label: "More", icon: Settings2 }
  ];

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
        aria-label="Close drawer"
      />

      <section className="absolute right-0 top-0 flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Edit Activity
              </p>

              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                {activity.title?.trim() || "Untitled Activity"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Keep common fields simple. Use tabs only when extra details are needed.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-blue-600 text-white "
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          {activeTab === "quick" && (
            <QuickSetupTab
              activity={activity}
              vendors={vendors}
              loadingVendors={loadingVendors}
              onUpdate={onUpdate}
            />
          )}

          {activeTab === "pricing" && (
            <PricingTab
              activity={activity}
              onUpdate={onUpdate}
            />
          )}

          {activeTab === "timing" && (
            <TimingTab
              timing={activity.timing || {}}
              onChange={timingPatch =>
                onUpdate({
                  timing: {
                    ...(activity.timing || {}),
                    ...timingPatch
                  }
                })
              }
            />
          )}

          {activeTab === "vendor" && (
            <VendorTab
              vendor={activity.vendor || {}}
              activity={activity}
              vendors={vendors}
              loadingVendors={loadingVendors}
              onUpdate={onUpdate}
            />
          )}

          {activeTab === "media" && (
            <MediaTab
              activity={activity}
              basePath={basePath}
              onUpdate={onUpdate}
            />
          )}

          {activeTab === "more" && (
            <MoreTab
              activity={activity}
              onUpdate={onUpdate}
            />
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Changes are saved into this destination form. Click destination save after editing.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================
   QUICK SETUP
========================= */

function QuickSetupTab({
  activity,
  vendors,
  loadingVendors,
  onUpdate
}) {
  const pricing = activity.pricing || {};
  const timing = activity.timing || {};
  const currency = pricing.currency || "USD";

  const patchPricing = patch => {
    onUpdate({
      pricing: calculateActivityPricing({
        ...pricing,
        ...patch
      })
    });
  };

  const patchPassenger = (key, patch) => {
    patchPricing({
      [key]: {
        ...(pricing[key] || {}),
        ...patch
      }
    });
  };

  return (
    <div className="space-y-5">
      <InfoBox>
        This quick setup covers the most-used fields: name, vendor, adult/child rate,
        duration, and status. Detailed fields are available in other tabs.
      </InfoBox>

      <SectionCard
        icon={Tag}
        title="Basic"
        description="Only required activity details."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Input
            label="Activity Name"
            value={activity.title}
            placeholder="Example: Desert Safari With BBQ Dinner"
            onChange={v => onUpdate({ title: v })}
          />

          <SelectField
            label="Activity Type"
            value={activity.activityType}
            onChange={v => onUpdate({ activityType: v })}
            options={ACTIVITY_TYPES}
          />
        </div>

        <Textarea
          label="Short Description"
          value={activity.description}
          placeholder="Describe the activity experience in 2-3 lines."
          onChange={v => onUpdate({ description: v })}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ToggleCard
            checked={activity.featured}
            title="Featured Activity"
            description="Highlight this activity in destination or quotation suggestions."
            onChange={checked => onUpdate({ featured: checked })}
          />

          <ToggleCard
            checked={activity.active}
            title="Active Activity"
            description="Only active activities should appear for quotation/package selection."
            onChange={checked => onUpdate({ active: checked })}
          />
        </div>
      </SectionCard>

      <VendorSelectorCard
        vendor={activity.vendor || {}}
        activity={activity}
        vendors={vendors}
        loadingVendors={loadingVendors}
        onUpdate={onUpdate}
      />

      <SectionCard
        icon={IndianRupee}
        title="Quick Rates"
        description="Adult and child vendor rates with selling price."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <SelectField
            label="Currency"
            value={currency}
            onChange={v =>
              patchPricing({
                currency: v,
                apiRateToInr: v === "INR" ? 1 : 0,
                companyRateToInr: v === "INR" ? 1 : 0,
                finalRoeToInr: v === "INR" ? 1 : 0
              })
            }
            options={SUPPORTED_CURRENCIES}
          />

          <Input
            label="Final ROE to INR"
            type="number"
            value={pricing.finalRoeToInr}
            onChange={v =>
              patchPricing({
                finalRoeToInr: toNumber(v)
              })
            }
          />

          <Input
            label="Duration"
            value={timing.duration}
            placeholder="Example: 6 Hours"
            onChange={v =>
              onUpdate({
                timing: {
                  ...(activity.timing || {}),
                  duration: v
                }
              })
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SimpleRateCard
            label="Adult Rate"
            currency={currency}
            passenger={pricing.adult}
            onChange={patch => patchPassenger("adult", patch)}
          />

          <SimpleRateCard
            label="Child Rate"
            currency={currency}
            passenger={pricing.child}
            onChange={patch => patchPassenger("child", patch)}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function SimpleRateCard({ label, currency, passenger, onChange }) {
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-xs text-slate-500">
        Age: {getAgeLabel(passenger)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Vendor Rate
          </label>

          <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3">
            <span className="text-sm font-semibold text-slate-500">
              {symbol}
            </span>

            <input
              type="number"
              value={passenger?.amount ?? 0}
              onChange={e =>
                onChange({
                  amount: toNumber(e.target.value)
                })
              }
              className="w-full border-0 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0"
            />
          </div>
        </div>

        <Input
          label="Markup"
          type="number"
          value={passenger?.markupValue}
          onChange={v =>
            onChange({
              markupValue: toNumber(v)
            })
          }
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniMoneyCard
          label="INR Cost"
          value={formatInr(passenger?.amountInInr)}
        />

        <MiniMoneyCard
          label="Selling"
          value={formatInr(passenger?.sellingInInr)}
          tone="success"
        />
      </div>
    </div>
  );
}

function MiniMoneyCard({ label, value, tone = "default" }) {
  return (
    <div
      className={`rounded-xl p-3 ${
        tone === "success"
          ? "bg-emerald-50 text-emerald-900"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

/* =========================
   PRICING TAB
========================= */

function PricingTab({ activity, onUpdate }) {
  const pricing = activity.pricing || {};
  const currency = pricing.currency || "USD";

  const [fetchingRoe, setFetchingRoe] = useState(false);
  const [roeError, setRoeError] = useState("");
  const [showRoeOverride, setShowRoeOverride] = useState(false);

  const patchPricing = patch => {
    onUpdate({
      pricing: calculateActivityPricing({
        ...pricing,
        ...patch
      })
    });
  };

  const patchPassenger = (key, patch) => {
    patchPricing({
      [key]: {
        ...(pricing[key] || {}),
        ...patch
      }
    });
  };

  const fetchRoe = async () => {
    try {
      setFetchingRoe(true);
      setRoeError("");

      const from = pricing.currency || "USD";
      const date = pricing.roeDate || new Date().toISOString().slice(0, 10);

      if (from === "INR") {
        patchPricing({
          apiRateToInr: 1,
          companyRateToInr: 1,
          finalRoeToInr: 1,
          roeProvider: "system",
          roeSource: "same_currency",
          roeDate: date,
          roeFetchedAt: new Date().toISOString()
        });
        return;
      }

      const params = new URLSearchParams({
        from,
        to: "INR",
        amount: "1",
        date
      });

      const response = await fetch(`/api/admin/roe?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Unable to fetch ROE.");
      }

      const apiRate = toNumber(data.finalRate || data.apiRate);

      patchPricing({
        apiRateToInr: apiRate,
        companyRateToInr:
          toNumber(pricing.companyRateToInr) > 0
            ? toNumber(pricing.companyRateToInr)
            : apiRate,
        finalRoeToInr:
          toNumber(pricing.finalRoeToInr) > 0
            ? toNumber(pricing.finalRoeToInr)
            : apiRate,
        roeProvider: data.provider || "api",
        roeSource: data.source || "api",
        roeDate: data.providerDate || date,
        roeFetchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(error);
      setRoeError(error.message || "Unable to fetch ROE.");
    } finally {
      setFetchingRoe(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard
        icon={IndianRupee}
        title="Pricing"
        description="Adult, child, and infant-wise vendor rate, INR cost, markup, and selling price."
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <SelectField
            label="Price Unit"
            value={pricing.priceUnit || "per_person"}
            onChange={v => patchPricing({ priceUnit: v })}
            options={PRICE_UNITS}
          />

          <SelectField
            label="Currency"
            value={currency}
            onChange={v =>
              patchPricing({
                currency: v,
                apiRateToInr: v === "INR" ? 1 : 0,
                companyRateToInr: v === "INR" ? 1 : 0,
                finalRoeToInr: v === "INR" ? 1 : 0
              })
            }
            options={SUPPORTED_CURRENCIES}
          />

          <Input
            label="ROE Date"
            type="date"
            value={pricing.roeDate}
            onChange={v => patchPricing({ roeDate: v })}
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchRoe}
              disabled={fetchingRoe}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw
                size={16}
                className={fetchingRoe ? "animate-spin" : ""}
              />
              {fetchingRoe ? "Fetching..." : "Fetch ROE"}
            </button>
          </div>
        </div>

        {roeError && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            <AlertCircle size={15} />
            {roeError}
          </div>
        )}

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-950">
                ROE: 1 {currency} = ₹{pricing.finalRoeToInr || 0}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Source: {pricing.roeProvider || "-"} | Date:{" "}
                {pricing.roeDate || "-"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowRoeOverride(prev => !prev)}
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 ring-1 ring-blue-200"
            >
              {showRoeOverride ? "Hide Override" : "Override ROE"}
            </button>
          </div>

          {showRoeOverride && (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Input
                label="API ROE"
                type="number"
                value={pricing.apiRateToInr}
                onChange={v => patchPricing({ apiRateToInr: toNumber(v) })}
              />

              <Input
                label="Company ROE"
                type="number"
                value={pricing.companyRateToInr}
                onChange={v =>
                  patchPricing({
                    companyRateToInr: toNumber(v),
                    finalRoeToInr: toNumber(v)
                  })
                }
              />

              <Input
                label="Final ROE"
                type="number"
                value={pricing.finalRoeToInr}
                onChange={v => patchPricing({ finalRoeToInr: toNumber(v) })}
              />
            </div>
          )}
        </div>

        <PassengerPricingTable
          currency={currency}
          pricing={pricing}
          onPassengerChange={patchPassenger}
        />
      </SectionCard>
    </div>
  );
}

function PassengerPricingTable({ currency, pricing, onPassengerChange }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 lg:grid">
        <span>Passenger</span>
        <span>Age</span>
        <span>Vendor Rate</span>
        <span>INR Cost</span>
        <span>Markup</span>
        <span>Selling</span>
        <span>Margin</span>
      </div>

      <PassengerRateRow
        passengerKey="adult"
        label="Adult"
        currency={currency}
        passenger={pricing.adult}
        onChange={patch => onPassengerChange("adult", patch)}
      />

      <PassengerRateRow
        passengerKey="child"
        label="Child"
        currency={currency}
        passenger={pricing.child}
        onChange={patch => onPassengerChange("child", patch)}
      />

      <PassengerRateRow
        passengerKey="infant"
        label="Infant"
        currency={currency}
        passenger={pricing.infant}
        onChange={patch => onPassengerChange("infant", patch)}
      />
    </div>
  );
}

function PassengerRateRow({ label, currency, passenger, onChange }) {
  const symbol = getCurrencySymbol(currency);
  const cost = toNumber(passenger?.amountInInr);
  const selling = toNumber(passenger?.sellingInInr);
  const margin = roundMoney(selling - cost);

  return (
    <div className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 lg:grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_1fr_1fr] lg:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 lg:hidden">
          Age: {getAgeLabel(passenger)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:block">
        <Input
          label="Min"
          type="number"
          value={passenger?.minAge}
          onChange={v => onChange({ minAge: toNumber(v) })}
        />

        <Input
          label="Max"
          type="number"
          value={passenger?.maxAge ?? ""}
          onChange={v =>
            onChange({
              maxAge: v === "" ? null : toNumber(v)
            })
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700 lg:hidden">
          Vendor Rate
        </label>

        <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3">
          <span className="text-sm font-semibold text-slate-500">
            {symbol}
          </span>

          <input
            type="number"
            value={passenger?.amount ?? 0}
            onChange={e =>
              onChange({
                amount: toNumber(e.target.value)
              })
            }
            className="w-full border-0 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0"
          />
        </div>
      </div>

      <ReadOnlyAmount label="INR Cost" value={formatInr(cost)} />

      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <SelectField
          label="Type"
          value={passenger?.markupType || "percentage"}
          onChange={v => onChange({ markupType: v })}
          options={MARKUP_TYPES}
        />

        <Input
          label="Value"
          type="number"
          value={passenger?.markupValue}
          onChange={v => onChange({ markupValue: toNumber(v) })}
        />
      </div>

      <ReadOnlyAmount
        label="Selling"
        value={formatInr(selling)}
        tone="success"
      />

      <ReadOnlyAmount
        label="Margin"
        value={formatInr(margin)}
        tone="blue"
      />
    </div>
  );
}

function ReadOnlyAmount({ label, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "blue"
        ? "bg-blue-50 text-blue-800"
        : "bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-xl px-3 py-2.5 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 lg:hidden">
        {label}
      </p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

/* =========================
   TIMING TAB
========================= */

function TimingTab({ timing, onChange }) {
  const toggleDay = day => {
    const current = Array.isArray(timing.operatingDays)
      ? timing.operatingDays
      : [];

    const next = current.includes(day)
      ? current.filter(item => item !== day)
      : [...current, day];

    onChange({ operatingDays: next });
  };

  return (
    <SectionCard
      icon={Clock}
      title="Timing & Operations"
      description="Use this only when activity timing or pickup details matter."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Input
          label="Duration"
          value={timing.duration}
          placeholder="Example: 6 Hours"
          onChange={v => onChange({ duration: v })}
        />

        <Input
          label="Start Time"
          type="time"
          value={timing.startTime}
          onChange={v => onChange({ startTime: v })}
        />

        <Input
          label="End Time"
          type="time"
          value={timing.endTime}
          onChange={v => onChange({ endTime: v })}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-700">
          Operating Days
        </label>

        <div className="flex flex-wrap gap-2">
          {OPERATING_DAYS.map(day => {
            const selected = timing.operatingDays?.includes(day.value);

            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-blue-200"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ToggleCard
          checked={timing.pickupRequired}
          title="Pickup Required"
          description="Enable when activity includes hotel pickup or reporting transfer."
          onChange={checked => onChange({ pickupRequired: checked })}
        />

        <Input
          label="Pickup Time"
          type="time"
          value={timing.pickupTime}
          onChange={v => onChange({ pickupTime: v })}
        />

        <Input
          label="Drop Time"
          type="time"
          value={timing.dropTime}
          onChange={v => onChange({ dropTime: v })}
        />
      </div>
    </SectionCard>
  );
}

/* =========================
   VENDOR TAB
========================= */

function VendorTab({
  vendor,
  activity,
  vendors = [],
  loadingVendors = false,
  onUpdate
}) {
  return (
    <div className="space-y-5">
      <VendorSelectorCard
        vendor={vendor}
        activity={activity}
        vendors={vendors}
        loadingVendors={loadingVendors}
        onUpdate={onUpdate}
      />

      <SectionCard
        icon={Building2}
        title="Vendor Snapshot"
        description="Snapshot is saved inside activity so old costing does not break if vendor profile changes."
      >
        <VendorSnapshotFields
          vendor={vendor}
          onUpdate={patch =>
            onUpdate({
              vendor: {
                ...(vendor || {}),
                ...patch
              }
            })
          }
        />
      </SectionCard>
    </div>
  );
}

function VendorSelectorCard({
  vendor,
  activity,
  vendors = [],
  loadingVendors = false,
  onUpdate
}) {
  const selectedVendorId = vendor.vendorId || "";

  const handleVendorSelect = vendorId => {
    if (!vendorId) {
      onUpdate({
        vendor: {
          vendorId: "",
          vendorName: "",
          contactPerson: "",
          phone: "",
          email: "",
          vendorCurrency: "",
          paymentTerms: "",
          cancellationPolicy: "",
          serviceType: ""
        }
      });
      return;
    }

    const selectedVendor = vendors.find(item => item.vendorId === vendorId);
    if (!selectedVendor) return;

    const nextVendor = {
      vendorId: selectedVendor.vendorId,
      vendorName: selectedVendor.vendorName,
      contactPerson: selectedVendor.contactPerson || "",
      phone: selectedVendor.phone || "",
      email: selectedVendor.email || "",
      vendorCurrency: selectedVendor.vendorCurrency || "",
      paymentTerms: selectedVendor.paymentTerms || "",
      cancellationPolicy: selectedVendor.cancellationPolicy || "",
      serviceType: selectedVendor.serviceType || ""
    };

    const vendorCurrency = selectedVendor.vendorCurrency;

    const nextPatch = {
      vendor: nextVendor
    };

    if (vendorCurrency) {
      nextPatch.pricing = calculateActivityPricing({
        ...(activity.pricing || {}),
        currency: vendorCurrency,
        apiRateToInr: vendorCurrency === "INR" ? 1 : 0,
        companyRateToInr: vendorCurrency === "INR" ? 1 : 0,
        finalRoeToInr: vendorCurrency === "INR" ? 1 : 0
      });
    }

    onUpdate(nextPatch);
  };

  return (
    <SectionCard
      icon={Building2}
      title="Select Vendor"
      description="Select vendor from Firebase. Currency and contact details will auto-fill."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Vendor
          </label>

          <select
            value={selectedVendorId}
            onChange={e => handleVendorSelect(e.target.value)}
            disabled={loadingVendors}
            className="mui-input bg-white"
          >
            <option value="">
              {loadingVendors ? "Loading vendors..." : "Select vendor"}
            </option>

            {vendors.map(item => (
              <option key={item.vendorId} value={item.vendorId}>
                {item.vendorName}
                {item.serviceType ? ` - ${item.serviceType}` : ""}
              </option>
            ))}
          </select>

          {!loadingVendors && vendors.length === 0 && (
            <p className="text-xs text-amber-600">
              No active vendors found in Firebase collection: vendors
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-700">
            Selected Vendor
          </p>

          <p className="mt-1 text-sm font-semibold text-emerald-950">
            {vendor.vendorName || "No vendor selected"}
          </p>

          <p className="mt-1 text-xs text-emerald-700">
            Currency: {vendor.vendorCurrency || "-"} | Type:{" "}
            {vendor.serviceType || "-"}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function VendorSnapshotFields({ vendor, onUpdate }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Input
          label="Vendor Name"
          value={vendor.vendorName}
          onChange={v => onUpdate({ vendorName: v })}
        />

        <Input
          label="Contact Person"
          value={vendor.contactPerson}
          onChange={v => onUpdate({ contactPerson: v })}
        />

        <Input
          label="Phone"
          value={vendor.phone}
          onChange={v => onUpdate({ phone: v })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Input
          label="Email"
          value={vendor.email}
          onChange={v => onUpdate({ email: v })}
        />

        <Input
          label="Vendor Currency"
          value={vendor.vendorCurrency}
          onChange={v =>
            onUpdate({
              vendorCurrency: String(v || "").toUpperCase()
            })
          }
        />

        <Input
          label="Service Type"
          value={vendor.serviceType}
          onChange={v => onUpdate({ serviceType: v })}
        />
      </div>

      <Input
        label="Payment Terms"
        value={vendor.paymentTerms}
        placeholder="Example: 100% advance, 7 days credit"
        onChange={v => onUpdate({ paymentTerms: v })}
      />
    </div>
  );
}

/* =========================
   MEDIA TAB
========================= */

function MediaTab({ activity, basePath, onUpdate }) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");

  const media = normalizeMediaGallery(activity.media || []);

  const youtubeItems = media.filter(
    item => item.type === "video" && item.source === "youtube"
  );

  const addYouTube = () => {
    const id = extractYouTubeId(youtubeUrl);

    if (!id) {
      alert("Please enter a valid YouTube URL.");
      return;
    }

    const nextItem = createYouTubeMediaItem(youtubeUrl, {
      title: youtubeTitle,
      order: media.length + 1
    });

    onUpdate({
      media: normalizeMediaGallery([...media, nextItem])
    });

    setYoutubeUrl("");
    setYoutubeTitle("");
  };

  const removeYouTube = id => {
    onUpdate({
      media: normalizeMediaGallery(media.filter(item => item.id !== id))
    });
  };

  const updateYouTube = (id, patch) => {
    onUpdate({
      media: normalizeMediaGallery(
        media.map(item =>
          item.id === id
            ? {
                ...item,
                ...patch,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      )
    });
  };

  return (
    <SectionCard
      icon={ImageIcon}
      title="Activity Media"
      description="Keep media optional. Add only when useful for sales preview."
    >
      <MediaUploader
        label="Activity Photos / Uploaded Videos"
        multiple
        value={activity.mediaUploads || []}
        path={`${basePath}/media`}
        onChange={files => onUpdate({ mediaUploads: files })}
      />

      <div className="rounded-2xl border border-red-100 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Youtube size={18} className="text-red-600" />
          <h4 className="text-sm font-semibold text-slate-900">
            YouTube Videos
          </h4>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <input
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="YouTube URL"
            className="mui-input bg-white"
          />

          <input
            value={youtubeTitle}
            onChange={e => setYoutubeTitle(e.target.value)}
            placeholder="Video title"
            className="mui-input bg-white"
          />

          <button
            type="button"
            onClick={addYouTube}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {youtubeItems.length > 0 && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {youtubeItems.map(item => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title || "YouTube video"}
                    className="h-36 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-slate-100 text-slate-400">
                    <Youtube size={30} />
                  </div>
                )}

                <div className="space-y-3 p-3">
                  <Input
                    label="Title"
                    value={item.title}
                    onChange={v => updateYouTube(item.id, { title: v })}
                  />

                  <Input
                    label="Caption"
                    value={item.caption}
                    onChange={v => updateYouTube(item.id, { caption: v })}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.featured}
                        onChange={e =>
                          updateYouTube(item.id, {
                            featured: e.target.checked
                          })
                        }
                      />
                      Featured
                    </label>

                    <button
                      type="button"
                      onClick={() => removeYouTube(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* =========================
   MORE TAB
========================= */

function MoreTab({ activity, onUpdate }) {
  return (
    <div className="space-y-5">
      <SectionCard
        icon={Users}
        title="Inclusions & Exclusions"
        description="Optional content for quotation or itinerary display."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <StringListEditor
            title="Inclusions"
            items={activity.inclusions || []}
            placeholder="Example: Hotel pickup"
            onChange={items => onUpdate({ inclusions: items })}
          />

          <StringListEditor
            title="Exclusions"
            items={activity.exclusions || []}
            placeholder="Example: Personal expenses"
            onChange={items => onUpdate({ exclusions: items })}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={Settings2}
        title="Terms & Internal Notes"
        description="Keep operational notes here."
      >
        <Textarea
          label="Cancellation Policy"
          value={activity.cancellationPolicy || activity.vendor?.cancellationPolicy || ""}
          placeholder="Example: Non-refundable within 24 hours."
          onChange={v => onUpdate({ cancellationPolicy: v })}
        />

        <Textarea
          label="Internal Notes"
          value={activity.internalNotes}
          placeholder="Internal notes for sales/operations team."
          onChange={v => onUpdate({ internalNotes: v })}
        />
      </SectionCard>
    </div>
  );
}

/* =========================
   STRING LIST EDITOR
========================= */

function StringListEditor({ title, items = [], placeholder, onChange }) {
  const [value, setValue] = useState("");

  const add = () => {
    const clean = value.trim();
    if (!clean) return;

    onChange([...(items || []), clean]);
    setValue("");
  };

  const remove = index => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-900">
        {title}
      </h4>

      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="mui-input bg-white"
        />

        <button
          type="button"
          onClick={add}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              {item}

              <button
                type="button"
                onClick={() => remove(index)}
                className="text-slate-400 hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

function InfoBox({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
      <Info size={18} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 ">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon size={19} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            {title}
          </h3>

          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text"
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="mui-input bg-white"
      />

      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  minHeight = "min-h-[100px]"
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">
        {label}
      </label>

      <textarea
        value={value ?? ""}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`mui-input ${minHeight} resize-y bg-white leading-relaxed`}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options = [] }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">
        {label}
      </label>

      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="mui-input bg-white"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleCard({ checked, title, description, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {title}
        </p>

        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}