"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function BottomSheetModal({
  open,
  onClose,
  title,
  children,
  maxHeight = "85vh",
  hideClose = false
}) {
  /* LOCK BACKGROUND SCROLL */
  useEffect(() => {
    if (!open) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* BOTTOM SHEET */}
      <div
        className="
          fixed w-full bottom-0 z-50 md:hidden
          bg-white
          rounded-t-xl
          shadow-2xl
          animate-slide-up
          flex flex-col
          overflow-hidden
          left-0
          p-3
        "
        style={{ maxHeight }}
      >
        {/* DRAG HANDLE */}
        <div className="flex justify-center py-2">
          <span className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* HEADER */}
        {(title || !hideClose) && (
          <div className="flex items-center justify-between px-4 pb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {title}
            </h2>

            {!hideClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-gray-100 active:bg-gray-200"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* CONTENT */}
        <div
          className="
            flex-1
            overflow-y-auto
            px-4
            pb-[calc(env(safe-area-inset-bottom)+96px)]
          "
        >
          {children}
        </div>
      </div>
    </>
  );
}
