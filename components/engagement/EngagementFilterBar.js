"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import BottomSheetModal from "@/components/ui/BottomSheetModal";
import EngagementFilterFields from "./EngagementFilterFields";

/* =========================
   MOBILE DETECTION
========================= */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);

    const handler = e => setIsMobile(e.matches);
    mq.addEventListener("change", handler);

    return () =>
      mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

export default function EngagementFilterBar({
  filters,
  setFilters
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  /* =========================
     DESKTOP (SAME AS TRAVEL AGENTS)
  ========================= */
  if (!isMobile) {
    return (
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-4 py-3">
        {/* 🔑 SAME STRUCTURE AS AGENT FILTER BAR */}
        <div className="flex flex-row gap-3 items-end flex-nowrap">
          <EngagementFilterFields
            filters={filters}
            setFilters={setFilters}
          />
        </div>
      </div>
    );
  }

  /* =========================
     MOBILE (UNCHANGED)
  ========================= */
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-30 bg-blue-600 text-white rounded-full p-4 shadow-lg"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      )}

      <BottomSheetModal
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
      >
        <div className="flex flex-col gap-4">
          <EngagementFilterFields
            filters={filters}
            setFilters={setFilters}
            onApply={() => setOpen(false)}
          />
        </div>
      </BottomSheetModal>
    </>
  );
}
