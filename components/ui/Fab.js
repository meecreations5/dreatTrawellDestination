"use client";

import { Plus, PhoneCall, FileText, Info } from "lucide-react";

export default function Fab({
  onFollowUp,
  onQuote,
  onDetails
}) {
  return (
    <div className="lg:hidden fixed bottom-6 right-6 z-50">
      <div className="relative group">

        {/* ACTION MENU */}
        <div
          className="
            absolute bottom-16 right-0
            flex flex-col gap-3
            opacity-0 scale-95
            pointer-events-none
            transition
            group-hover:opacity-100
            group-hover:scale-100
            group-hover:pointer-events-auto
          "
        >
          <FabItem
            icon={<PhoneCall size={16} />}
            label="Follow-up"
            onClick={onFollowUp}
          />
          <FabItem
            icon={<FileText size={16} />}
            label="Quotation"
            onClick={onQuote}
          />
          <FabItem
            icon={<Info size={16} />}
            label="Details"
            onClick={onDetails}
          />
        </div>

        {/* MAIN FAB */}
        <button
          className="
            w-14 h-14 rounded-full
            bg-blue-600 text-white
            flex items-center justify-center
            shadow-lg
            active:scale-95
          "
        >
          <Plus />
        </button>
      </div>
    </div>
  );
}

function FabItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        flex items-center gap-3
        bg-white shadow-md
        px-4 py-2 rounded-full
        text-sm
      "
    >
      <span className="text-blue-600">{icon}</span>
      {label}
    </button>
  );
}
