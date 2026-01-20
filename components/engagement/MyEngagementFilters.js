"use client";

import { useState } from "react";
import { Search, Sliders } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function EngagementFilters({
  filters,
  setFilters
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  /* ================= DESKTOP ================= */
  if (!isMobile) {
    return (
      <div className="flex gap-2 mb-4">
        <input
          placeholder="Search…"
          className="border rounded-lg px-3 py-2 w-64"
          onChange={e =>
            setFilters(f => ({
              ...f,
              search: e.target.value
            }))
          }
        />

        <select
          className="border rounded-lg px-3 py-2"
          onChange={e =>
            setFilters(f => ({
              ...f,
              channel: e.target.value
            }))
          }
        >
          <option value="all">All Channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
    );
  }

  /* ================= MOBILE ================= */
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg"
        >
          <Search className="w-4 h-4" />
          Search & Filter
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex justify-between">
            <span className="font-medium">
              Filters
            </span>
            <button
              onClick={() =>
                setOpen(false)
              }
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <input
              placeholder="Search message, SPOC"
              className="w-full border rounded-lg px-3 py-2"
              onChange={e =>
                setFilters(f => ({
                  ...f,
                  search: e.target.value
                }))
              }
            />

            <select
              className="w-full border rounded-lg px-3 py-2"
              onChange={e =>
                setFilters(f => ({
                  ...f,
                  channel:
                    e.target.value
                }))
              }
            >
              <option value="all">
                All Channels
              </option>
              <option value="email">
                Email
              </option>
              <option value="whatsapp">
                WhatsApp
              </option>
            </select>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <button
              onClick={() =>
                setOpen(false)
              }
              className="w-full bg-blue-600 text-white py-3 rounded-lg"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </>
  );
}
