"use client";

import { useState, useEffect } from "react";

/* =========================
   TEMPLATE CATEGORY DRAWER
========================= */

export default function TemplateCategoryDrawer({
  category,
  onClose,
  onSave
}) {
  const [form, setForm] = useState({
    name: category.name || "",
    code: category.code || "",
    active: !!category.active,
    requireAttachment: !!category.rules?.requireAttachment
  });

  /* =========================
     SYNC WHEN CATEGORY CHANGES
  ========================= */
  useEffect(() => {
    setForm({
      name: category.name || "",
      code: category.code || "",
      active: !!category.active,
      requireAttachment: !!category.rules?.requireAttachment
    });
  }, [category]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="fixed inset-0 z-50 bg-black/20">
      <div className="absolute right-0 top-0 h-full w-[420px] bg-white shadow-xl flex flex-col">

        {/* HEADER */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">
            Edit Category
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 space-y-4 text-sm flex-1 overflow-y-auto">

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Category Name
            </label>
            <input
              value={form.name}
              onChange={e =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Category Code
            </label>
            <input
              value={form.code}
              onChange={e =>
                setForm({ ...form, code: e.target.value })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.requireAttachment}
              onChange={e =>
                setForm({
                  ...form,
                  requireAttachment: e.target.checked
                })
              }
            />
            Require attachment
          </label>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e =>
                setForm({
                  ...form,
                  active: e.target.checked
                })
              }
            />
            Active
          </label>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-600"
          >
            Cancel
          </button>

          <button
            onClick={() => onSave(form)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
