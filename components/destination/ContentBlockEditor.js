"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  EyeOff,
  ImageIcon,
  Link2,
  MapPin,
  Plus,
  Star,
  Trash2,
  Youtube
} from "lucide-react";

import MediaUploader from "./MediaUploader";

/* =========================
   HELPERS
========================= */

function createId(prefix = "content") {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getSingularLabel(title = "Item") {
  const clean = String(title || "Item").trim();

  if (clean.toLowerCase().includes("attraction")) return "Attraction";
  if (clean.toLowerCase().includes("place")) return "Place";
  if (clean.toLowerCase().includes("food")) return "Food / Culture Highlight";

  return clean.replace(/s$/, "") || "Item";
}

function getEditorDescription(title) {
  const key = String(title || "").toLowerCase();

  if (key.includes("attraction")) {
    return "Add famous landmarks, tourist attractions, monuments, theme parks, or iconic sightseeing points.";
  }

  if (key.includes("place")) {
    return "Add cities, local areas, beaches, markets, islands, viewpoints, or neighbourhoods worth visiting.";
  }

  if (key.includes("food")) {
    return "Add local cuisine, cultural experiences, food streets, traditional shows, and eating recommendations.";
  }

  return "Add destination content with description, photos, map link, video, and source reference.";
}

function normalizeItem(item = {}, index = 0) {
  return {
    id: item.id || createId("content"),

    // Backward compatible fields
    name: item.name || item.title || "",
    title: item.title || item.name || "",

    description: item.description || "",
    photos: Array.isArray(item.photos) ? item.photos : [],

    youtube: item.youtube || item.youtubeUrl || "",
    youtubeUrl: item.youtubeUrl || item.youtube || "",

    mapLink: item.mapLink || item.googleMapLink || "",
    sourceLink: item.sourceLink || "",

    featured: Boolean(item.featured),
    active: item.active ?? true,
    order: Number(item.order || index + 1)
  };
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .filter(Boolean)
    .map((item, index) => normalizeItem(item, index))
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

function getPrimaryPhoto(item) {
  return item.photos?.[0]?.url || item.photos?.[0] || "";
}

/* =========================
   MAIN COMPONENT
========================= */

export default function ContentBlockEditor({
  title,
  description,
  items = [],
  onChange,
  basePath
}) {
  const blocks = useMemo(() => normalizeItems(items), [items]);

  const [openId, setOpenId] = useState(blocks[0]?.id || "");

  const itemLabel = getSingularLabel(title);
  const helperDescription = description || getEditorDescription(title);

  const emit = nextItems => {
    onChange?.(normalizeItems(nextItems));
  };

  const addItem = () => {
    const newItem = normalizeItem(
      {
        id: createId("content"),
        name: "",
        title: "",
        description: "",
        photos: [],
        youtube: "",
        youtubeUrl: "",
        mapLink: "",
        sourceLink: "",
        featured: false,
        active: true
      },
      blocks.length
    );

    emit([...blocks, newItem]);
    setOpenId(newItem.id);
  };

  const updateItem = (id, patch) => {
    emit(
      blocks.map(item => {
        if (item.id !== id) return item;

        const next = {
          ...item,
          ...patch
        };

        // Keep old and new naming compatible
        if (patch.title !== undefined) {
          next.name = patch.title;
        }

        if (patch.name !== undefined) {
          next.title = patch.name;
        }

        if (patch.youtube !== undefined) {
          next.youtubeUrl = patch.youtube;
        }

        if (patch.youtubeUrl !== undefined) {
          next.youtube = patch.youtubeUrl;
        }

        return next;
      })
    );
  };

  const removeItem = id => {
    const item = blocks.find(block => block.id === id);

    const confirmed = window.confirm(
      `Remove "${item?.title || item?.name || itemLabel}"?`
    );

    if (!confirmed) return;

    const next = blocks.filter(block => block.id !== id);

    emit(
      next.map((block, index) => ({
        ...block,
        order: index + 1
      }))
    );

    if (openId === id) {
      setOpenId(next[0]?.id || "");
    }
  };

  const moveItem = (index, direction) => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    emit(reorderItems(blocks, index, nextIndex));
  };

  return (
    <section className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {title}
          </h2>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            {helperDescription}
          </p>
        </div>

        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          Add {itemLabel}
        </button>
      </div>

      {/* EMPTY */}
      {blocks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <ImageIcon size={22} />
          </div>

          <h3 className="text-base font-semibold text-slate-950">
            No {title} added yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add {itemLabel.toLowerCase()} details with description, photo,
            YouTube link, map link, and source reference.
          </p>

          <button
            type="button"
            onClick={addItem}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Add {itemLabel}
          </button>
        </div>
      )}

      {/* ITEMS */}
      {blocks.length > 0 && (
        <div className="space-y-4">
          {blocks.map((item, index) => (
            <ContentBlockCard
              key={item.id}
              item={item}
              index={index}
              total={blocks.length}
              title={title}
              itemLabel={itemLabel}
              basePath={`${basePath}/${item.id}`}
              open={openId === item.id}
              onToggle={() =>
                setOpenId(openId === item.id ? "" : item.id)
              }
              onUpdate={patch => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
              onMove={direction => moveItem(index, direction)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================
   CARD
========================= */

function ContentBlockCard({
  item,
  index,
  total,
  itemLabel,
  basePath,
  open,
  onToggle,
  onUpdate,
  onRemove,
  onMove
}) {
  const primaryPhoto = getPrimaryPhoto(item);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* CARD HEADER */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={item.title || item.name || itemLabel}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <ImageIcon size={22} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-950">
                {item.title || item.name || `${itemLabel} ${index + 1}`}
              </h3>

              {item.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <Star size={11} />
                  Featured
                </span>
              )}

              {!item.active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  <EyeOff size={11} />
                  Hidden
                </span>
              )}
            </div>

            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
              {item.description || "Description not added yet."}
            </p>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {item.photos?.length || 0} photo(s)
              </span>

              {item.youtube && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-600">
                  YouTube
                </span>
              )}

              {item.mapLink && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-600">
                  Map
                </span>
              )}
            </div>
          </div>

          <div className="pt-1 text-slate-400">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Move up"
          >
            <ArrowUp size={15} />
          </button>

          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Move down"
          >
            <ArrowDown size={15} />
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 transition hover:bg-red-50"
            aria-label="Remove item"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* EDIT BODY */}
      {open && (
        <div className="space-y-5 bg-slate-50/60 p-4 lg:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              label={`${itemLabel} Name`}
              value={item.title || item.name}
              placeholder={`Example: ${itemLabel} name`}
              onChange={value => onUpdate({ title: value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <ToggleCard
                checked={item.featured}
                title="Featured"
                description="Highlight this item publicly."
                onChange={checked => onUpdate({ featured: checked })}
              />

              <ToggleCard
                checked={item.active}
                title="Active"
                description="Show this item publicly."
                onChange={checked => onUpdate({ active: checked })}
              />
            </div>
          </div>

          <Textarea
            label="Description"
            value={item.description}
            placeholder="Add short public-facing description or useful notes."
            onChange={value => onUpdate({ description: value })}
          />

          <MediaUploader
            label="Photos"
            multiple
            path={`${basePath}/photos`}
            value={item.photos || []}
            onChange={files => onUpdate({ photos: files })}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Input
              icon={Youtube}
              label="YouTube Video Link"
              value={item.youtube || item.youtubeUrl}
              placeholder="https://youtube.com/..."
              onChange={value => onUpdate({ youtube: value })}
            />

            <Input
              icon={MapPin}
              label="Google Map Link"
              value={item.mapLink}
              placeholder="https://maps.google.com/..."
              onChange={value => onUpdate({ mapLink: value })}
            />

            <Input
              icon={Link2}
              label="Source / Reference Link"
              value={item.sourceLink}
              placeholder="Official website or reference link"
              onChange={value => onUpdate({ sourceLink: value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

function Input({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        {Icon && <Icon size={14} />}
        {label}
      </label>

      <input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="mui-input bg-white"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder
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
        className="mui-input min-h-[100px] resize-y bg-white leading-relaxed"
      />
    </div>
  );
}

function ToggleCard({
  checked,
  title,
  description,
  onChange
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
      <div>
        <p className="text-xs font-semibold text-slate-900">
          {title}
        </p>

        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}