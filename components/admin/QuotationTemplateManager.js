// src/components/admin/QuotationTemplateManager.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
    collection,
    onSnapshot,
    orderBy,
    query
} from "firebase/firestore";
import {
    CheckCircle2,
    FileText,
    Loader2,
    Plus,
    Save,
    Settings2,
    Sparkles
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
    DESTINATION_QUOTATION_TEMPLATES_COLLECTION,
    QUOTATION_AUTO_SECTION_KEYS,
    QUOTATION_SECTION_LABELS,
    QUOTATION_SECTION_TYPES,
    normalizeDestinationQuotationTemplate,
    upsertDestinationQuotationTemplate,
    slugifyDestination
} from "@/lib/quotationTemplateService";

/* =========================
   UI CLASSES
========================= */

const inputClass = `
  w-full rounded-xl border border-gray-200 bg-white px-3 py-2
  text-sm text-gray-900 outline-none
  focus:border-blue-300 focus:ring-2 focus:ring-blue-100
`;

const textareaClass = `
  w-full rounded-xl border border-gray-200 bg-white px-3 py-2
  text-sm text-gray-900 outline-none resize-none
  focus:border-blue-300 focus:ring-2 focus:ring-blue-100
`;

const sectionCardClass =
    "rounded-3xl border border-gray-100 bg-white shadow-sm";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
    return String(value || "").trim();
}

function parseLines(value = "") {
    return String(value || "")
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}

function serializeLines(items = []) {
    return Array.isArray(items) ? items.join("\n") : "";
}

function parseAliases(value = "") {
    return String(value || "")
        .split(/\r?\n|,/)
        .map(item => item.trim())
        .filter(Boolean);
}

function parseTableRows(value = "") {
    return String(value || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            if (line.includes("\t")) {
                return line.split("\t").map(cell => cell.trim());
            }

            return line.split("|").map(cell => cell.trim());
        });
}

function serializeTableRows(rows = []) {
    if (!Array.isArray(rows)) return "";

    return rows
        .filter(row => Array.isArray(row))
        .map(row => row.join(" | "))
        .join("\n");
}

function getDestinationName(destination = {}) {
    return cleanString(
        destination.destinationName ||
        destination.name ||
        destination.title ||
        destination.destinationTitle ||
        destination.city ||
        destination.country
    );
}

function getDestinationCountry(destination = {}) {
    return cleanString(
        destination.country ||
        destination.countryName ||
        destination.location?.country ||
        ""
    );
}

function getDestinationCode(destination = {}) {
    return cleanString(
        destination.destinationCode ||
        destination.code ||
        destination.slug ||
        destination.id ||
        ""
    );
}

function getDefaultSectionType(key) {
    if (
        key === "customerVisibleNote" ||
        key === "localOperationalNotes" ||
        key === "regulationDisclaimer"
    ) {
        return "text";
    }

    if (
        key === "holidayList" ||
        key === "beachClubNotes" ||
        key === "vehicleRules" ||
        key === "arrivalRequirements" ||
        key === "tourismLevy" ||
        key === "visaNotes"
    ) {
        return "html";
    }

    if (key === "beachClubTerms") {
        return "bullets";
    }

    return "bullets";
}

function getDefaultColumns(key) {
    if (key === "holidayList") {
        return ["Date", "Occasion"];
    }

    if (key === "beachClubNotes") {
        return ["Club Name", "Special Benefit"];
    }

    return [];
}

function createDefaultSection(key) {
    const optionalSections = [
        "beachClubNotes",
        "beachClubTerms"
    ];

    const defaultEnabled = !optionalSections.includes(key);

    return {
        enabled: defaultEnabled,
        defaultIncluded: defaultEnabled,
        title: QUOTATION_SECTION_LABELS[key] || "Section",
        type: getDefaultSectionType(key),
        items: [],
        columns: getDefaultColumns(key),
        rows: [],
        html: "",
        text: ""
    };
}

function createDefaultForm() {
    const sections = {};

    QUOTATION_AUTO_SECTION_KEYS.forEach(key => {
        sections[key] = createDefaultSection(key);
    });

    return {
        templateId: "",
        destinationId: "",
        destinationCode: "",
        destinationSlug: "",
        destinationName: "",
        country: "",
        aliasesText: "",
        active: true,
        sections
    };
}

function templateToForm(template) {
    const sections = {};

    QUOTATION_AUTO_SECTION_KEYS.forEach(key => {
        sections[key] = {
            ...createDefaultSection(key),
            ...(template?.sections?.[key] || {})
        };
    });

    return {
        templateId:
            template?.templateId ||
            template?.destinationId ||
            template?.id ||
            "",
        destinationId:
            template?.sourceDestinationId ||
            template?.linkedDestinationId ||
            "",
        destinationName: template?.destinationName || "",
        country: template?.country || "",
        aliasesText: Array.isArray(template?.aliases)
            ? template.aliases.join("\n")
            : "",
        active: template?.active !== false,
        sections
    };
}

/* =========================
   SMALL COMPONENTS
========================= */

function StatusPill({ active }) {
    return (
        <span
            className={`
        inline-flex items-center rounded-full border px-2.5 py-1
        text-[11px] font-semibold
        ${active
                    ? "border-green-100 bg-green-50 text-green-700"
                    : "border-gray-200 bg-gray-50 text-gray-500"
                }
      `}
        >
            {active ? "Active" : "Inactive"}
        </span>
    );
}

function SectionPreview({ section }) {
    if (!section?.enabled) {
        return (
            <p className="text-xs text-gray-400">
                This section is disabled.
            </p>
        );
    }

    if (section.type === "bullets") {
        const items = Array.isArray(section.items) ? section.items : [];

        if (!items.length) {
            return <p className="text-xs text-gray-400">No bullet items added.</p>;
        }

        return (
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
                {items.slice(0, 5).map((item, index) => (
                    <li key={index}>{item}</li>
                ))}

                {items.length > 5 && (
                    <li className="text-gray-400">
                        + {items.length - 5} more
                    </li>
                )}
            </ul>
        );
    }

    if (section.type === "table") {
        const columns = Array.isArray(section.columns) ? section.columns : [];
        const rows = Array.isArray(section.rows) ? section.rows : [];

        if (!columns.length || !rows.length) {
            return <p className="text-xs text-gray-400">No table data added.</p>;
        }

        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr>
                            {columns.map((column, index) => (
                                <th
                                    key={index}
                                    className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold text-gray-600"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {rows.slice(0, 4).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {columns.map((_, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        className="border border-gray-200 px-2 py-1 text-gray-600"
                                    >
                                        {row?.[cellIndex] || "—"}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {rows.length > 4 && (
                    <p className="mt-2 text-[11px] text-gray-400">
                        + {rows.length - 4} more rows
                    </p>
                )}
            </div>
        );
    }

    if (section.type === "html") {
        const text = cleanString(
            String(section.html || "").replace(/<[^>]*>/g, " ")
        );

        return (
            <p className="text-xs text-gray-600">
                {text.slice(0, 220) || "No HTML content added."}
                {text.length > 220 ? "..." : ""}
            </p>
        );
    }

    return (
        <p className="text-xs text-gray-600">
            {section.text || "No text content added."}
        </p>
    );
}

function SectionEditor({ sectionKey, section, onChange }) {
    const title = section?.title || QUOTATION_SECTION_LABELS[sectionKey];

    const update = patch => {
        onChange(sectionKey, {
            ...section,
            ...patch
        });
    };

    return (
        <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        {title}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                        Key: {sectionKey}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                        <input
                            type="checkbox"
                            checked={Boolean(section.enabled)}
                            onChange={event =>
                                update({
                                    enabled: event.target.checked,
                                    defaultIncluded: event.target.checked
                                        ? section.defaultIncluded
                                        : false
                                })
                            }
                            className="rounded border-gray-300"
                        />
                        Enable
                    </label>

                    <label className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        <input
                            type="checkbox"
                            checked={Boolean(section.defaultIncluded)}
                            disabled={!section.enabled}
                            onChange={event =>
                                update({
                                    defaultIncluded: event.target.checked
                                })
                            }
                            className="rounded border-gray-300"
                        />
                        Default Include
                    </label>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-500">
                        Section Title
                    </label>

                    <input
                        className={inputClass}
                        value={section.title || ""}
                        onChange={event =>
                            update({
                                title: event.target.value
                            })
                        }
                        placeholder={QUOTATION_SECTION_LABELS[sectionKey]}
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-500">
                        Content Type
                    </label>

                    <select
                        className={inputClass}
                        value={section.type || "bullets"}
                        onChange={event =>
                            update({
                                type: event.target.value
                            })
                        }
                    >
                        {QUOTATION_SECTION_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-4">
                {section.type === "bullets" && (
                    <div>
                        <label className="text-xs font-medium text-gray-500">
                            Bullet Items
                        </label>

                        <textarea
                            className={textareaClass}
                            rows={6}
                            value={serializeLines(section.items)}
                            onChange={event =>
                                update({
                                    items: parseLines(event.target.value)
                                })
                            }
                            placeholder={`Enter one point per line\nExample: International airfare is not included.`}
                        />
                    </div>
                )}

                {section.type === "text" && (
                    <div>
                        <label className="text-xs font-medium text-gray-500">
                            Plain Text
                        </label>

                        <textarea
                            className={textareaClass}
                            rows={6}
                            value={section.text || ""}
                            onChange={event =>
                                update({
                                    text: event.target.value
                                })
                            }
                            placeholder="Write plain text here..."
                        />
                    </div>
                )}

                {section.type === "html" && (
                    <div>
                        <label className="text-xs font-medium text-gray-500">
                            HTML / Rich Text
                        </label>

                        <textarea
                            className={textareaClass}
                            rows={8}
                            value={section.html || ""}
                            onChange={event =>
                                update({
                                    html: event.target.value
                                })
                            }
                            placeholder={`Example:\n<p>Visa on Arrival is available for Indian passport holders.</p>\n<ul><li>Passport validity should be minimum 6 months.</li></ul>`}
                        />

                        <p className="mt-1 text-[11px] text-gray-400">
                            Basic HTML like p, ul, li, strong, br, table is supported.
                        </p>
                    </div>
                )}

                {section.type === "table" && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div>
                            <label className="text-xs font-medium text-gray-500">
                                Columns
                            </label>

                            <textarea
                                className={textareaClass}
                                rows={5}
                                value={serializeLines(section.columns)}
                                onChange={event =>
                                    update({
                                        columns: parseLines(event.target.value)
                                    })
                                }
                                placeholder={`Date\nOccasion`}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-gray-500">
                                Rows
                            </label>

                            <textarea
                                className={textareaClass}
                                rows={5}
                                value={serializeTableRows(section.rows)}
                                onChange={event =>
                                    update({
                                        rows: parseTableRows(event.target.value)
                                    })
                                }
                                placeholder={`16 June 2026 | Islamic New Year\n17 June 2026 | Galungan Ceremony`}
                            />

                            <p className="mt-1 text-[11px] text-gray-400">
                                Separate columns with pipe `|` or paste directly from Excel.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Preview
                </p>

                <SectionPreview section={section} />
            </div>
        </div>
    );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function QuotationTemplateManager() {
    const { user } = useAuth();

    const [templates, setTemplates] = useState([]);
    const [destinations, setDestinations] = useState([]);

    const [loading, setLoading] = useState(true);
    const [destinationLoading, setDestinationLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [selectedId, setSelectedId] = useState("");
    const [form, setForm] = useState(createDefaultForm);

    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");

    /* =========================
       LOAD DESTINATIONS
    ========================== */

    useEffect(() => {
        setDestinationLoading(true);

        const unsub = onSnapshot(
            collection(db, "destinations"),
            snapshot => {
                const rows = snapshot.docs
                    .map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    }))
                    .map(item => ({
                        ...item,
                        displayName: getDestinationName(item),
                        displayCountry: getDestinationCountry(item),
                        displayCode: getDestinationCode(item)
                    }))
                    .filter(item => item.displayName)
                    .sort((a, b) =>
                        a.displayName.localeCompare(b.displayName)
                    );

                setDestinations(rows);
                setDestinationLoading(false);
            },
            () => {
                setDestinations([]);
                setDestinationLoading(false);
            }
        );

        return () => unsub();
    }, []);

    /* =========================
       LOAD TEMPLATES
    ========================== */

    useEffect(() => {
        setLoading(true);
        setLoadError("");

        const q = query(
            collection(db, DESTINATION_QUOTATION_TEMPLATES_COLLECTION),
            orderBy("destinationName", "asc")
        );

        const unsub = onSnapshot(
            q,
            snapshot => {
                const rows = snapshot.docs.map(docSnap =>
                    normalizeDestinationQuotationTemplate(
                        docSnap.data(),
                        docSnap.id
                    )
                );

                setTemplates(rows);
                setLoading(false);
            },
            error => {
                setLoadError(
                    error?.message || "Failed to load quotation templates."
                );
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const selectedTemplate = useMemo(() => {
        if (!selectedId) return null;

        return templates.find(
            template =>
                template.id === selectedId ||
                template.templateId === selectedId ||
                template.destinationId === selectedId
        );
    }, [templates, selectedId]);

    const handleNew = () => {
        setSelectedId("");
        setForm(createDefaultForm());
        setSaveMessage("");
        setSaveError("");
    };

    const handleSelect = template => {
        setSelectedId(
            template.templateId ||
            template.destinationId ||
            template.id
        );

        setForm(templateToForm(template));
        setSaveMessage("");
        setSaveError("");
    };

    const updateForm = patch => {
        setForm(prev => ({
            ...prev,
            ...patch
        }));
    };

    const updateSection = (key, section) => {
        setForm(prev => ({
            ...prev,
            sections: {
                ...(prev.sections || {}),
                [key]: section
            }
        }));
    };

    const handleDestinationSelect = destinationId => {
        const destination = destinations.find(item => item.id === destinationId);

        if (!destination) {
            updateForm({
                destinationId: destination.id,
                destinationCode,
                destinationSlug: slugifyDestination(destinationName),
                destinationName,
                country,
                templateId,
                aliasesText: Array.from(aliasSet).join("\n")
            });
            return;
        }

        const destinationName = destination.displayName;
        const country = destination.displayCountry;
        const destinationCode = destination.displayCode;

        const templateId =
            destination.id ||
            destinationCode ||
            slugifyDestination(destinationName);

        const aliasSet = new Set([
            destinationName,
            country ? `${destinationName}, ${country}` : "",
            destinationCode,
            slugifyDestination(destinationName)
        ].filter(Boolean));

        updateForm({
            destinationId: destination.id,
            destinationName,
            country,
            templateId,
            aliasesText: Array.from(aliasSet).join("\n")
        });
    };

    const handleDestinationNameChange = value => {
        setForm(prev => {
            const shouldAutoFillId =
                !selectedId &&
                (!prev.templateId ||
                    prev.templateId === slugifyDestination(prev.destinationName));

            return {
                ...prev,
                destinationName: value,
                templateId: shouldAutoFillId
                    ? slugifyDestination(value)
                    : prev.templateId
            };
        });
    };

    const handleSave = async () => {
        setSaveMessage("");
        setSaveError("");

        const destinationName = cleanString(form.destinationName);

        if (!destinationName) {
            setSaveError("Destination name is required.");
            return;
        }

        setSaving(true);

        try {
            const cleanTemplateId =
                cleanString(form.templateId) ||
                cleanString(form.destinationId) ||
                slugifyDestination(destinationName);

            const result = await upsertDestinationQuotationTemplate({
                templateId: cleanTemplateId,

                destinationId: form.destinationId,
                sourceDestinationId: form.destinationId,
                linkedDestinationId: form.destinationId,
                destinationCode: form.destinationCode,
                destinationSlug: form.destinationSlug,

                destinationName,
                country: form.country,
                aliases: parseAliases(form.aliasesText),
                active: form.active,
                sections: form.sections,
                user
            });

            /*
              Extra fields are included inside sections/template payload indirectly
              through templateId + aliases.
              If you update quotationTemplateService later, add:
              sourceDestinationId: form.destinationId
            */

            const savedId =
                result.templateId ||
                result.destinationId ||
                result.id ||
                cleanTemplateId;

            setSelectedId(savedId);
            setForm(prev => ({
                ...prev,
                templateId: savedId
            }));

            setSaveMessage("Quotation template saved successfully.");
        } catch (error) {
            setSaveError(
                error?.message || "Failed to save quotation template."
            );
        } finally {
            setSaving(false);
        }
    };

    const stats = useMemo(() => {
        return {
            total: templates.length,
            active: templates.filter(item => item.active !== false).length,
            inactive: templates.filter(item => item.active === false).length
        };
    }, [templates]);

    return (
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-5 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                                    <Settings2 size={20} />
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                                        Admin Settings
                                    </p>

                                    <h1 className="text-2xl font-bold tracking-tight">
                                        Quotation Templates
                                    </h1>
                                </div>
                            </div>

                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                                Manage destination-wise predefined quotation sections. Select
                                destination directly from Firebase destination master to keep
                                quotation connection clean.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleNew}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-blue-50"
                        >
                            <Plus size={16} />
                            New Template
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs text-gray-400">Total</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">
                            {stats.total}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-green-50 px-4 py-3">
                        <p className="text-xs text-green-600">Active</p>
                        <p className="mt-1 text-xl font-bold text-green-700">
                            {stats.active}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-gray-100 px-4 py-3">
                        <p className="text-xs text-gray-500">Inactive</p>
                        <p className="mt-1 text-xl font-bold text-gray-700">
                            {stats.inactive}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* LEFT LIST */}
                <aside className="lg:col-span-4">
                    <div className={sectionCardClass}>
                        <div className="border-b border-gray-100 px-4 py-4">
                            <p className="text-sm font-semibold text-gray-900">
                                Destination Templates
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                                Select a destination template to edit.
                            </p>
                        </div>

                        <div className="max-h-[72vh] overflow-y-auto p-3">
                            {loading ? (
                                <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading templates...
                                </div>
                            ) : loadError ? (
                                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                                    {loadError}
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                                    <FileText
                                        size={28}
                                        className="mx-auto text-gray-300"
                                    />

                                    <p className="mt-3 text-sm font-semibold text-gray-800">
                                        No templates yet
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Create your first destination quotation template.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map(template => {
                                        const id =
                                            template.templateId ||
                                            template.destinationId ||
                                            template.id;

                                        const active =
                                            selectedId === id ||
                                            selectedId === template.id;

                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => handleSelect(template)}
                                                className={`
                          w-full rounded-2xl border p-4 text-left transition
                          ${active
                                                        ? "border-blue-200 bg-blue-50"
                                                        : "border-gray-100 bg-white hover:bg-gray-50"
                                                    }
                        `}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-gray-900">
                                                            {template.destinationName || "Untitled"}
                                                        </p>

                                                        <p className="mt-1 truncate text-xs text-gray-500">
                                                            {template.country || "Country not set"}
                                                        </p>

                                                        <p className="mt-1 truncate text-[11px] text-gray-400">
                                                            ID: {id}
                                                        </p>
                                                    </div>

                                                    <StatusPill active={template.active !== false} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* RIGHT FORM */}
                <section className="lg:col-span-8">
                    <div className={sectionCardClass}>
                        <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {selectedTemplate ? "Edit Template" : "Create Template"}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Select destination from Firebase destination master, then
                                        define auto sections for quotation.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {saving ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    {saving ? "Saving..." : "Save Template"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-5 p-5">
                            {saveError && (
                                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {saveError}
                                </div>
                            )}

                            {saveMessage && (
                                <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                                    {saveMessage}
                                </div>
                            )}

                            {/* BASIC DETAILS */}
                            <div className="rounded-3xl border border-gray-100 bg-white p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <Sparkles size={17} className="text-blue-600" />
                                    <p className="text-sm font-semibold text-gray-900">
                                        Destination Details
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-500">
                                            Select Destination from Firebase
                                        </label>

                                        <select
                                            className={inputClass}
                                            value={form.destinationId}
                                            onChange={event =>
                                                handleDestinationSelect(event.target.value)
                                            }
                                        >
                                            <option value="">
                                                {destinationLoading
                                                    ? "Loading destinations..."
                                                    : "Select destination"}
                                            </option>

                                            {destinations.map(destination => (
                                                <option key={destination.id} value={destination.id}>
                                                    {destination.displayName}
                                                    {destination.displayCountry
                                                        ? `, ${destination.displayCountry}`
                                                        : ""}
                                                </option>
                                            ))}
                                        </select>

                                        <p className="mt-1 text-[11px] text-gray-400">
                                            This pulls destinations directly from your Firebase
                                            destinations collection.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-500">
                                            Destination Name
                                        </label>

                                        <input
                                            className={inputClass}
                                            value={form.destinationName}
                                            onChange={event =>
                                                handleDestinationNameChange(event.target.value)
                                            }
                                            placeholder="Bali, Indonesia"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-500">
                                            Template ID
                                        </label>

                                        <input
                                            className={inputClass}
                                            value={form.templateId}
                                            onChange={event =>
                                                updateForm({
                                                    templateId: event.target.value
                                                })
                                            }
                                            placeholder="bali_indonesia"
                                        />

                                        <p className="mt-1 text-[11px] text-gray-400">
                                            Auto-filled from selected Firebase destination.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-500">
                                            Country
                                        </label>

                                        <input
                                            className={inputClass}
                                            value={form.country}
                                            onChange={event =>
                                                updateForm({
                                                    country: event.target.value
                                                })
                                            }
                                            placeholder="Indonesia"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-500">
                                            Status
                                        </label>

                                        <select
                                            className={inputClass}
                                            value={form.active ? "active" : "inactive"}
                                            onChange={event =>
                                                updateForm({
                                                    active: event.target.value === "active"
                                                })
                                            }
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-500">
                                            Aliases
                                        </label>

                                        <textarea
                                            className={textareaClass}
                                            rows={3}
                                            value={form.aliasesText}
                                            onChange={event =>
                                                updateForm({
                                                    aliasesText: event.target.value
                                                })
                                            }
                                            placeholder={`Bali\nIndonesia/Bali\nBali, Indonesia`}
                                        />

                                        <p className="mt-1 text-[11px] text-gray-400">
                                            Aliases help quotation builder find the template even if
                                            destination name is written slightly differently.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SECTIONS */}
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        Destination-wise Auto Sections
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Enabled sections can be selected inside quotation builder.
                                        Default included sections will be auto-selected.
                                    </p>
                                </div>

                                {QUOTATION_AUTO_SECTION_KEYS.map(key => (
                                    <SectionEditor
                                        key={key}
                                        sectionKey={key}
                                        section={form.sections?.[key] || createDefaultSection(key)}
                                        onChange={updateSection}
                                    />
                                ))}
                            </div>

                            <div className="sticky bottom-0 -mx-5 border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-gray-500">
                                        Save this template, then use same destination in quotation
                                        builder.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {saving ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        {saving ? "Saving..." : "Save Template"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}