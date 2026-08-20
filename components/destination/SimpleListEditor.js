"use client";

import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2
} from "lucide-react";

/* =========================
   HELPERS
========================= */

function createId(prefix = "item") {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    id: item.id || createId("list"),
    order: item.order || index + 1,
    active: item.active ?? true,
    ...item
  }));
}

function createEmptyItem(fields = []) {
  const item = {
    id: createId("list"),
    order: 1,
    active: true
  };

  fields.forEach(field => {
    item[field.key] = field.defaultValue ?? "";
  });

  return item;
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

function getItemTitle(item, fields, index) {
  const titleField =
    fields.find(field => field.key === "name") ||
    fields.find(field => field.key === "label") ||
    fields.find(field => field.key === "title") ||
    fields[0];

  return item?.[titleField?.key] || `Item ${index + 1}`;
}

/* =========================
   COMPONENT
========================= */

export default function SimpleListEditor({
  title = "Items",
  description = "",
  items = [],
  onChange,
  fields = []
}) {
  const list = useMemo(() => normalizeItems(items), [items]);

  const emit = nextItems => {
    onChange?.(
      normalizeItems(nextItems).map((item, index) => ({
        ...item,
        order: index + 1
      }))
    );
  };

  const add = () => {
    const nextItem = {
      ...createEmptyItem(fields),
      order: list.length + 1
    };

    emit([...list, nextItem]);
  };

  const update = (itemId, key, value) => {
    emit(
      list.map(item =>
        item.id === itemId
          ? {
              ...item,
              [key]: value
            }
          : item
      )
    );
  };

  const remove = itemId => {
    const item = list.find(row => row.id === itemId);

    const confirmed = window.confirm(
      `Remove "${item?.name || item?.label || item?.title || "this item"}"?`
    );

    if (!confirmed) return;

    emit(list.filter(item => item.id !== itemId));
  };

  const duplicate = itemId => {
    const item = list.find(row => row.id === itemId);
    if (!item) return;

    emit([
      ...list,
      {
        ...item,
        id: createId("list"),
        order: list.length + 1
      }
    ]);
  };

  const move = (index, direction) => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    emit(reorderItems(list, index, nextIndex));
  };

  return (
    <section className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              {description}
            </p>
          ) : (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Add, edit, reorder, or remove {title.toLowerCase()}.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          Add {title}
        </button>
      </div>

      {/* EMPTY */}
      {list.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="text-base font-semibold text-slate-950">
            No {title} added yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add your first {title.toLowerCase()} entry.
          </p>

          <button
            type="button"
            onClick={add}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Add {title}
          </button>
        </div>
      )}

      {/* LIST */}
      {list.length > 0 && (
        <div className="space-y-4">
          {list.map((item, index) => (
            <div
              key={item.id || index}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    {getItemTitle(item, fields, index)}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {title} #{index + 1}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, "up")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Move up"
                  >
                    <ArrowUp size={15} />
                  </button>

                  <button
                    type="button"
                    disabled={index === list.length - 1}
                    onClick={() => move(index, "down")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Move down"
                  >
                    <ArrowDown size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicate(item.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
                    aria-label="Duplicate"
                  >
                    <Copy size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 transition hover:bg-red-50"
                    aria-label="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {fields.map(field => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={item[field.key]}
                    onChange={value => update(item.id, field.key, value)}
                  />
                ))}
              </div>

              <div className="mt-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={item.active !== false}
                    onChange={e =>
                      update(item.id, "active", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Active
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================
   FIELD INPUT
========================= */

function FieldInput({ field, value, onChange }) {
  const type = field.type || "text";

  if (type === "textarea") {
    return (
      <div className="space-y-1.5 md:col-span-2">
        <label className="text-xs font-semibold text-slate-700">
          {field.label}
        </label>

        <textarea
          value={value ?? ""}
          placeholder={field.placeholder || field.label}
          rows={field.rows || 3}
          onChange={e => onChange(e.target.value)}
          className="mui-input min-h-[90px] resize-y bg-white leading-relaxed"
        />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700">
          {field.label}
        </label>

        <select
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className="mui-input bg-white"
        >
          {(field.options || []).map(option => (
            <option
              key={option.value ?? option}
              value={option.value ?? option}
            >
              {option.label ?? option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">
        {field.label}
      </label>

      <input
        type={type}
        value={value ?? ""}
        placeholder={field.placeholder || field.label}
        onChange={e => onChange(e.target.value)}
        className="mui-input bg-white"
      />
    </div>
  );
}