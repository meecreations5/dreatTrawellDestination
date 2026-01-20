"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import BottomSheetModal from "@/components/ui/BottomSheetModal";
import AgentFilters from "./AgentFilter";

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

export default function AgentFilterBar({
  filters,
  setFilters
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  /* =========================
     DESKTOP FILTER BAR (FIXED)
  ========================= */
  if (!isMobile) {
    return (
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-4 py-3">
        {/* 🔴 THIS CONTAINER WAS MISSING BEFORE */}
        <div className="flex flex-row gap-4 items-end">
          <AgentFilters
            filters={filters}
            setFilters={setFilters}
          />
        </div>
      </div>
    );
  }

  /* =========================
     MOBILE
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
        {/* Mobile stack */}
        <div className="flex flex-col gap-4">
          <AgentFilters
            filters={filters}
            setFilters={setFilters}
            onApply={() => setOpen(false)}
          />
        </div>
      </BottomSheetModal>
    </>
  );
}
