"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Filter,
  LayoutGrid,
  Mail,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Table2,
  Trash2,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/rolePermissions";
import ImportDefaultTemplatesButton from "@/components/admin/communication-templates/ImportDefaultTemplatesButton";

/* =========================
   OPTIONS
========================= */

const TEMPLATE_TYPES = [
  { value: "message", label: "Message" },
  { value: "promotion", label: "Promotion" },
  { value: "package", label: "Package" },
  { value: "itinerary", label: "Itinerary" },
  { value: "document", label: "Document" },
  { value: "vendor", label: "Vendor" },
  { value: "internal", label: "Internal" }
];

const COMMON_INTENTS = [
  "new_agent_intro",
  "ask_requirement",
  "send_destination_package",
  "send_promotion",
  "quote_follow_up",
  "no_response_follow_up",
  "hot_lead_follow_up",
  "payment_reminder",
  "revision_confirmation",
  "meeting_follow_up",
  "lost_lead_reconnect",
  "thank_you_relationship"
];

const COMMON_OUTCOMES = [
  "intro_done",
  "profile_shared",
  "call_not_picked",
  "no_response",
  "followup_required",
  "future_follow_up",
  "requirement_pending",
  "requirement_received",
  "quote_needed",
  "quote_shared",
  "revision_needed",
  "payment_pending",
  "not_interested",
  "meeting_scheduled",
  "general_update"
];

const EMPTY_FORM = {
  name: "",
  templateType: "message",
  categoryCode: "general",
  categoryName: "General",

  intentCodes: "",
  outcomeCodes: "",

  emailEnabled: true,
  whatsappEnabled: true,

  emailSubject: "",
  emailHtml: "",
  whatsappText: "",

  active: true
};

/* =========================
   HELPERS
========================= */

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function cleanSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCsv(value = "") {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isDeleted(template = {}) {
  return (
    template?.deleted === true ||
    template?.isDeleted === true ||
    template?.archived === true
  );
}

function getTemplateTypeLabel(type = "") {
  return TEMPLATE_TYPES.find(item => item.value === type)?.label || "Template";
}

function getChannels(template = {}) {
  const channels = [];

  if (template?.channels?.email === true || template?.emailHtml) {
    channels.push("email");
  }

  if (template?.channels?.whatsapp === true || template?.whatsappText) {
    channels.push("whatsapp");
  }

  return channels;
}

function getStatusLabel(template = {}) {
  if (isDeleted(template)) return "Deleted";
  if (template?.active === false) return "Inactive";
  if (template?.status === "draft") return "Draft";
  return "Active";
}

function getStatusClass(template = {}) {
  const status = getStatusLabel(template);

  if (status === "Active") {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (status === "Draft") {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  if (status === "Inactive") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-red-100 bg-red-50 text-red-700";
}

function getUserName(user = {}) {
  return (
    user?.displayName ||
    user?.name ||
    user?.fullName ||
    user?.email ||
    "Team Member"
  );
}

/* =========================
   PAGE
========================= */

export default function CommunicationTemplatesPage() {
  const { user } = useAuth();
  const canCreateTemplate = canAccess(user, "communications.create");
  const canEditTemplate = canAccess(user, "communications.edit");

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [viewMode, setViewMode] = useState("grid");

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "communicationTemplates"),
      snapshot => {
        const rows = snapshot.docs
          .map(document => ({
            id: document.id,
            ...document.data()
          }))
          .filter(template => !isDeleted(template))
          .sort((a, b) => {
            const aTime = toDate(a.updatedAt || a.createdAt)?.getTime() || 0;
            const bTime = toDate(b.updatedAt || b.createdAt)?.getTime() || 0;

            if (bTime !== aTime) return bTime - aTime;

            return String(a.name || "").localeCompare(String(b.name || ""));
          });

        setTemplates(rows);
        setLoading(false);
      },
      error => {
        console.error("Failed to load communication templates:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const uniqueIntentCodes = useMemo(() => {
    const set = new Set(COMMON_INTENTS);

    templates.forEach(template => {
      if (Array.isArray(template.intentCodes)) {
        template.intentCodes.forEach(code => {
          if (code) set.add(code);
        });
      }
    });

    return Array.from(set).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const keyword = normalize(search);

    return templates.filter(template => {
      const channels = getChannels(template);

      const matchesSearch =
        !keyword ||
        normalize(template.name).includes(keyword) ||
        normalize(template.slug).includes(keyword) ||
        normalize(template.categoryName).includes(keyword) ||
        normalize(template.categoryCode).includes(keyword) ||
        normalize(template.templateType).includes(keyword) ||
        (Array.isArray(template.intentCodes) &&
          template.intentCodes.some(code => normalize(code).includes(keyword))) ||
        (Array.isArray(template.outcomeCodes) &&
          template.outcomeCodes.some(code => normalize(code).includes(keyword)));

      const matchesChannel =
        channelFilter === "all" || channels.includes(channelFilter);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && template.active !== false) ||
        (statusFilter === "inactive" && template.active === false) ||
        (statusFilter === "system" && template.systemTemplate === true);

      const matchesType =
        typeFilter === "all" ||
        normalize(template.templateType) === normalize(typeFilter);

      const matchesIntent =
        intentFilter === "all" ||
        (Array.isArray(template.intentCodes) &&
          template.intentCodes.includes(intentFilter));

      return (
        matchesSearch &&
        matchesChannel &&
        matchesStatus &&
        matchesType &&
        matchesIntent
      );
    });
  }, [
    templates,
    search,
    channelFilter,
    statusFilter,
    typeFilter,
    intentFilter
  ]);

  const stats = useMemo(() => {
    return {
      total: templates.length,
      active: templates.filter(item => item.active !== false).length,
      smartMapped: templates.filter(item => {
        return (
          Array.isArray(item.intentCodes) &&
          item.intentCodes.length > 0
        ) || (
          Array.isArray(item.outcomeCodes) &&
          item.outcomeCodes.length > 0
        );
      }).length,
      email: templates.filter(item => getChannels(item).includes("email")).length,
      whatsapp: templates.filter(item => getChannels(item).includes("whatsapp")).length,
      system: templates.filter(item => item.systemTemplate === true).length
    };
  }, [templates]);

  async function createTemplate() {
    if (!canCreateTemplate) {
      alert("You do not have permission to create communication templates.");
      return;
    }

    const name = cleanString(form.name);

    if (!name) {
      alert("Template name is required");
      return;
    }

    if (!form.emailEnabled && !form.whatsappEnabled) {
      alert("Select at least one channel");
      return;
    }

    try {
      setSaving(true);

      const slug = cleanSlug(name);

      await addDoc(collection(db, "communicationTemplates"), {
        slug,
        name,

        templateType: form.templateType || "message",
        categoryCode: cleanString(form.categoryCode) || "general",
        categoryName:
          cleanString(form.categoryName) ||
          cleanString(form.categoryCode) ||
          "General",

        intentCodes: parseCsv(form.intentCodes),
        outcomeCodes: parseCsv(form.outcomeCodes),

        channels: {
          email: Boolean(form.emailEnabled),
          whatsapp: Boolean(form.whatsappEnabled)
        },

        emailSubject: form.emailEnabled ? form.emailSubject : "",
        emailHtml: form.emailEnabled ? form.emailHtml : "",
        whatsappText: form.whatsappEnabled ? form.whatsappText : "",

        destinationIds: [],
        destinationNames: [],
        primaryDestination: "",

        defaultAssets: [],
        defaultAssetIds: [],
        defaultAssetTitles: [],

        active: Boolean(form.active),
        status: form.active ? "active" : "draft",

        systemTemplate: false,
        editable: true,
        source: "manual",

        usageCount: 0,
        lastUsedAt: null,

        deleted: false,
        isDeleted: false,
        archived: false,

        createdByUid: user?.uid || "",
        createdByName: getUserName(user),
        createdByEmail: user?.email || "",

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setForm(EMPTY_FORM);
      setCreateOpen(false);
    } catch (error) {
      console.error("Failed to create template:", error);
      alert("Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(template) {
    if (!canEditTemplate) {
      alert("You do not have permission to edit communication templates.");
      return;
    }
    try {
      await updateDoc(doc(db, "communicationTemplates", template.id), {
        active: template.active === false,
        status: template.active === false ? "active" : "draft",
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to update template:", error);
      alert("Failed to update template");
    }
  }

  async function softDeleteTemplate(template) {
    if (!canEditTemplate) {
      alert("You do not have permission to edit communication templates.");
      return;
    }
    const confirmed = window.confirm(
      `Delete template "${template.name}"? This will hide it from communication flow.`
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "communicationTemplates", template.id), {
        deleted: true,
        isDeleted: true,
        active: false,
        status: "deleted",
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to delete template:", error);
      alert("Failed to delete template");
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-9xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white ">
          <div className="bg-gradient-to-r from-[#1d4e89] via-[#285f9f] to-[#9b0112] px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  Smart Communication Library
                </div>

                <h1 className="mt-3 text-2xl font-bold">
                  Communication Templates
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">
                  Manage WhatsApp and email templates mapped with intent codes,
                  outcome codes and smart communication flow.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <ImportDefaultTemplatesButton />

                {canCreateTemplate && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1d4e89]  hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                  New Template
                </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white p-4 md:grid-cols-6">
            <StatCard label="Total" value={stats.total} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Smart" value={stats.smartMapped} icon={<Sparkles className="h-5 w-5" />} />
            <StatCard label="Email" value={stats.email} icon={<Mail className="h-5 w-5" />} />
            <StatCard label="WhatsApp" value={stats.whatsapp} icon={<MessageCircle className="h-5 w-5" />} />
            <StatCard label="System" value={stats.system} icon={<Archive className="h-5 w-5" />} />
          </div>
        </div>

        {/* FILTERS */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 ">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                <Filter className="h-3.5 w-3.5" />
                Filter Library
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Search, filter and switch between grid or table view.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  viewMode === "grid"
                    ? "bg-white text-blue-700 "
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  viewMode === "table"
                    ? "bg-white text-blue-700 "
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Table2 className="h-4 w-4" />
                Table
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search template, intent, outcome, category..."
                className="form-input pl-9"
              />
            </div>

            <select
              value={channelFilter}
              onChange={event => setChannelFilter(event.target.value)}
              className="form-input"
            >
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>

            <select
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value)}
              className="form-input"
            >
              <option value="all">All Types</option>
              {TEMPLATE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              className="form-input"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="system">System Templates</option>
            </select>

            <select
              value={intentFilter}
              onChange={event => setIntentFilter(event.target.value)}
              className="form-input"
            >
              <option value="all">All Intents</option>
              {uniqueIntentCodes.map(code => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setChannelFilter("all");
                setTypeFilter("all");
                setStatusFilter("all");
                setIntentFilter("all");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              No templates found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Import default templates or create a new communication template.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <TemplatesTable
            templates={filteredTemplates}
            onToggle={toggleActive}
            onDelete={softDeleteTemplate}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onToggle={() => toggleActive(template)}
                onDelete={() => softDeleteTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>

      {canCreateTemplate && createOpen && (
        <CreateTemplateModal
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => {
            if (saving) return;
            setCreateOpen(false);
            setForm(EMPTY_FORM);
          }}
          onSave={createTemplate}
        />
      )}
    </div>
  );
}

/* =========================
   VIEW COMPONENTS
========================= */

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 ">
          {icon}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, onToggle, onDelete }) {
  const channels = getChannels(template);
  const intentCodes = Array.isArray(template.intentCodes)
    ? template.intentCodes
    : [];
  const outcomeCodes = Array.isArray(template.outcomeCodes)
    ? template.outcomeCodes
    : [];

  const smartMapped = intentCodes.length > 0 || outcomeCodes.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white  transition hover:border-blue-200 hover:shadow-md">
      <div className="border-b border-slate-100 bg-[#1d4e89] px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                {getTemplateTypeLabel(template.templateType)}
              </span>

              {template.systemTemplate && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#1d4e89]">
                  System
                </span>
              )}

              {smartMapped && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  Smart Mapped
                </span>
              )}
            </div>

            <h3 className="mt-3 line-clamp-1 text-lg font-bold">
              {template.name || "Untitled Template"}
            </h3>

            <p className="mt-1 line-clamp-1 text-xs text-blue-100">
              {template.categoryName || template.categoryCode || "General"}
            </p>
          </div>

          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(template)}`}>
            {getStatusLabel(template)}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {channels.includes("email") && (
            <Badge tone="blue" icon={<Mail className="h-3.5 w-3.5" />}>
              Email
            </Badge>
          )}

          {channels.includes("whatsapp") && (
            <Badge tone="green" icon={<MessageCircle className="h-3.5 w-3.5" />}>
              WhatsApp
            </Badge>
          )}

          {!smartMapped && (
            <Badge>Not Mapped</Badge>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <CodeBadges
            title="Intent Codes"
            codes={intentCodes}
            emptyText="No intent mapped"
            tone="blue"
          />

          <div className="mt-3">
            <CodeBadges
              title="Outcome Codes"
              codes={outcomeCodes}
              emptyText="No outcome mapped"
              tone="purple"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <InfoItem
            label="Usage"
            value={`${Number(template.usageCount || 0)} time(s)`}
          />

          <InfoItem
            label="Last Used"
            value={formatDate(template.lastUsedAt)}
          />

          <InfoItem
            label="Updated"
            value={formatDate(template.updatedAt || template.createdAt)}
          />

          <InfoItem
            label="Source"
            value={template.source || "manual"}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="min-w-0 text-xs text-slate-500">
            <p className="truncate">
              {template.destinationNames?.length
                ? template.destinationNames.join(", ")
                : "General template"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {template.slug || template.id}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/admin/communication-templates/${template.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Eye className="h-3.5 w-3.5" />
              Open
            </Link>

            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title={template.active === false ? "Activate" : "Deactivate"}
            >
              <Archive className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-600 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplatesTable({ templates = [], onToggle, onDelete }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
      <div className="border-b border-slate-100 bg-[#1d4e89] px-5 py-4 text-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold">
              Template Library Table
            </h3>
            <p className="mt-0.5 text-xs text-blue-100">
              Review templates with channel, mapping, status and usage details.
            </p>
          </div>

          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
            {templates.length} Template{templates.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-left text-xs font-bold uppercase tracking-wide text-white">
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Smart Mapping</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {templates.map(template => {
              const channels = getChannels(template);
              const intentCodes = Array.isArray(template.intentCodes)
                ? template.intentCodes
                : [];
              const outcomeCodes = Array.isArray(template.outcomeCodes)
                ? template.outcomeCodes
                : [];

              const smartMapped =
                intentCodes.length > 0 || outcomeCodes.length > 0;

              return (
                <tr key={template.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 align-top">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">
                          {template.name || "Untitled Template"}
                        </p>

                        {template.systemTemplate && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                            System
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {template.categoryName || template.categoryCode || "General"} ·{" "}
                        {getTemplateTypeLabel(template.templateType)}
                      </p>

                      <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-slate-400">
                        {template.slug || template.id}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {channels.includes("email") && (
                        <Badge tone="blue" icon={<Mail className="h-3.5 w-3.5" />}>
                          Email
                        </Badge>
                      )}

                      {channels.includes("whatsapp") && (
                        <Badge tone="green" icon={<MessageCircle className="h-3.5 w-3.5" />}>
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    {smartMapped ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {intentCodes.slice(0, 2).map(code => (
                            <span
                              key={code}
                              className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700"
                            >
                              {code}
                            </span>
                          ))}

                          {intentCodes.length > 2 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                              +{intentCodes.length - 2}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {outcomeCodes.slice(0, 2).map(code => (
                            <span
                              key={code}
                              className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700"
                            >
                              {code}
                            </span>
                          ))}

                          {outcomeCodes.length > 2 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                              +{outcomeCodes.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        Not mapped
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(template)}`}>
                      {getStatusLabel(template)}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p className="text-sm font-bold text-slate-900">
                      {Number(template.usageCount || 0)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Last: {formatDate(template.lastUsedAt)}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-top text-xs text-slate-600">
                    {formatDate(template.updatedAt || template.createdAt)}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/communication-templates/${template.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white hover:bg-slate-800"
                        title="Open"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => onToggle(template)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title={template.active === false ? "Activate" : "Deactivate"}
                      >
                        <Archive className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(template)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ children, tone = "slate", icon = null }) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700"
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${classes[tone] || classes.slate}`}>
      {icon}
      {children}
    </span>
  );
}

function CodeBadges({ title, codes = [], emptyText = "", tone = "blue" }) {
  const safeCodes = Array.isArray(codes) ? codes.filter(Boolean) : [];

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      {safeCodes.length ? (
        <div className="flex flex-wrap gap-1.5">
          {safeCodes.map(code => (
            <Badge key={code} tone={tone}>
              {code}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate font-bold text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

/* =========================
   CREATE MODAL
========================= */

function CreateTemplateModal({
  form,
  setForm,
  saving,
  onClose,
  onSave
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-[#1d4e89] via-[#285f9f] to-[#9b0112] px-5 py-5 text-white sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
                <Sparkles className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  New Communication Template
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">
                  Create WhatsApp and email content, map it with smart intent,
                  and make it available in Send Communication.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              <FormSection
                icon={<FileText className="h-4 w-4" />}
                title="Basic Details"
                description="Name, type and category help your team identify this template quickly."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Template Name"
                    hint="Example: Call Not Answered, Quotation Follow-Up"
                    required
                  >
                    <input
                      value={form.name}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          name: event.target.value
                        }))
                      }
                      placeholder="Enter template name"
                      className="form-input"
                    />
                  </Field>

                  <Field
                    label="Template Type"
                    hint="Use Message for most email/WhatsApp templates."
                  >
                    <select
                      value={form.templateType}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          templateType: event.target.value
                        }))
                      }
                      className="form-input"
                    >
                      {TEMPLATE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Category Code"
                    hint="Internal code. Example: follow_up"
                  >
                    <input
                      value={form.categoryCode}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          categoryCode: event.target.value
                        }))
                      }
                      placeholder="follow_up"
                      className="form-input"
                    />
                  </Field>

                  <Field
                    label="Category Name"
                    hint="Readable category shown in admin."
                  >
                    <input
                      value={form.categoryName}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          categoryName: event.target.value
                        }))
                      }
                      placeholder="Follow Up"
                      className="form-input"
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={<Sparkles className="h-4 w-4" />}
                title="Smart Mapping"
                description="These mappings help Send Communication recommend the right template automatically."
                tone="blue"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <CodePicker
                    label="Intent Codes"
                    hint="Select one or more communication intents."
                    fieldName="intentCodes"
                    value={form.intentCodes}
                    options={COMMON_INTENTS}
                    tone="blue"
                    placeholder="Select intent"
                    setForm={setForm}
                  />

                  <CodePicker
                    label="Outcome Codes"
                    hint="Select one or more engagement outcomes."
                    fieldName="outcomeCodes"
                    value={form.outcomeCodes}
                    options={COMMON_OUTCOMES}
                    tone="purple"
                    placeholder="Select outcome"
                    setForm={setForm}
                  />
                </div>
              </FormSection>

              {form.emailEnabled && (
                <FormSection
                  icon={<Mail className="h-4 w-4" />}
                  title="Email Content"
                  description="Email should be HTML emailer content. Logo and signature will come from Branding Settings."
                  tone="blue"
                >
                  <div className="space-y-4">
                    <Field label="Email Subject">
                      <input
                        value={form.emailSubject}
                        onChange={event =>
                          setForm(prev => ({
                            ...prev,
                            emailSubject: event.target.value
                          }))
                        }
                        placeholder="Follow-up from {{companyName}}"
                        className="form-input"
                      />
                    </Field>

                    <Field
                      label="Email HTML"
                      hint="Use variables like {{spocName}}, {{companyLogoUrl}}, {{signature}}, {{assetLinksHtml}}"
                    >
                      <textarea
                        value={form.emailHtml}
                        onChange={event =>
                          setForm(prev => ({
                            ...prev,
                            emailHtml: event.target.value
                          }))
                        }
                        rows={10}
                        placeholder="<div>Dear {{spocName}},...</div>"
                        className="form-input font-mono text-xs leading-6"
                      />
                    </Field>
                  </div>
                </FormSection>
              )}

              {form.whatsappEnabled && (
                <FormSection
                  icon={<MessageCircle className="h-4 w-4" />}
                  title="WhatsApp Content"
                  description="Keep WhatsApp short, clean and readable. Assets will be shared as links."
                  tone="green"
                >
                  <Field
                    label="WhatsApp Text"
                    hint="Plain text only. Use {{signature}} at the end."
                  >
                    <textarea
                      value={form.whatsappText}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          whatsappText: event.target.value
                        }))
                      }
                      rows={10}
                      placeholder={`Hi {{spocName}},

Message here...

{{signature}}`}
                      className="form-input leading-6"
                    />
                  </Field>
                </FormSection>
              )}
            </div>

            <aside className="space-y-5">
              <section className="sticky top-0 rounded-2xl border border-slate-200 bg-white p-5 ">
                <h3 className="text-sm font-bold text-slate-950">
                  Template Settings
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choose where this template can be used.
                </p>

                <div className="mt-4 space-y-3">
                  <ToggleCard
                    active={form.emailEnabled}
                    icon={<Mail className="h-4 w-4" />}
                    title="Email Enabled"
                    description="Available while sending email."
                    tone="blue"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        emailEnabled: !prev.emailEnabled
                      }))
                    }
                  />

                  <ToggleCard
                    active={form.whatsappEnabled}
                    icon={<MessageCircle className="h-4 w-4" />}
                    title="WhatsApp Enabled"
                    description="Available while sending WhatsApp."
                    tone="green"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        whatsappEnabled: !prev.whatsappEnabled
                      }))
                    }
                  />

                  <ToggleCard
                    active={form.active}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    title="Active Template"
                    description="Inactive templates will not appear while sending."
                    tone="slate"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        active: !prev.active
                      }))
                    }
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-bold text-amber-800">
                    Supported Variables
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      "{{spocName}}",
                      "{{companyName}}",
                      "{{destination}}",
                      "{{companyLogoUrl}}",
                      "{{signature}}",
                      "{{assetLinksHtml}}"
                    ].map(item => (
                      <span
                        key={item}
                        className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-amber-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-700">
                    Save Behaviour
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    After saving, this template will appear in Send Communication
                    based on channel, destination and smart mapping.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Required: Template Name and at least one channel.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white  hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   FORM HELPERS
========================= */

function FormSection({
  icon,
  title,
  description,
  children,
  tone = "slate"
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700"
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 ">
      <div className="mb-4 flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            toneClass[tone] || toneClass.slate
          }`}
        >
          {icon}
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-950">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function CodePicker({
  label,
  hint = "",
  fieldName,
  value,
  options = [],
  tone = "blue",
  placeholder = "Select",
  setForm
}) {
  const selectedCodes = parseCsv(value);
  const [selectedOption, setSelectedOption] = useState("");

  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
    purple: "border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100"
  };

  const addCode = code => {
    if (!code) return;

    setForm(prev => {
      const current = parseCsv(prev[fieldName]);
      if (current.includes(code)) return prev;

      return {
        ...prev,
        [fieldName]: [...current, code].join(", ")
      };
    });

    setSelectedOption("");
  };

  const removeCode = code => {
    setForm(prev => {
      const current = parseCsv(prev[fieldName]).filter(item => item !== code);

      return {
        ...prev,
        [fieldName]: current.join(", ")
      };
    });
  };

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <select
          value={selectedOption}
          onChange={event => setSelectedOption(event.target.value)}
          className="form-input"
        >
          <option value="">{placeholder}</option>
          {options.map(code => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => addCode(selectedOption)}
          disabled={!selectedOption}
          className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {selectedCodes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedCodes.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => removeCode(code)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                toneClass[tone] || toneClass.blue
              }`}
              title="Click to remove"
            >
              {code}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
          No code selected yet.
        </p>
      )}
    </Field>
  );
}

function Field({
  label,
  hint = "",
  required = false,
  children
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function ToggleCard({
  active,
  icon,
  title,
  description,
  tone = "blue",
  onClick
}) {
  const activeClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-300 bg-slate-50 text-slate-800"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition hover: ${
        active
          ? activeClass[tone] || activeClass.blue
          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            active ? "bg-white/80" : "bg-slate-100"
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold">
            {title}
          </p>

          {description && (
            <p className="mt-0.5 text-xs leading-5 opacity-80">
              {description}
            </p>
          )}
        </div>

        <span
          className={`ml-auto mt-1 h-5 w-9 rounded-full p-0.5 transition ${
            active ? "bg-current/20" : "bg-slate-200"
          }`}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white  transition ${
              active ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </div>
    </button>
  );
}