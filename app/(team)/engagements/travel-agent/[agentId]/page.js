"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { Plus } from "lucide-react";

import { db } from "@/lib/firebase";

import EngagementForm from "./EngagementForm";
import EngagementCard from "@/components/engagement/EngagementCard";
import BottomSheetModal from "@/components/ui/BottomSheetModal"; // ✅ SAME MODAL AS ATTENDANCE
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";
import HeaderSkeleton from "@/components/ui/HeaderSkeleton";

/* =========================
   MOBILE DETECTION
========================= */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    setIsMobile(mq.matches);
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

/* =========================
   DATE HELPERS
========================= */
const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const formatDateLabel = date => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

export default function EngagementPage() {
  const { agentId } = useParams();
  const todayRef = useRef(null);
  const isMobile = useIsMobile();

  const [agent, setAgent] = useState(null);
  const [engagements, setEngagements] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsedDates, setCollapsedDates] = useState({});
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);

  /* =========================
     LOAD AGENT
  ========================== */
  useEffect(() => {
    if (!agentId) return;

    getDoc(doc(db, "travelAgents", agentId)).then(snap => {
      if (snap.exists()) {
        setAgent({ id: snap.id, ...snap.data() });
      }
    });
  }, [agentId]);

  /* =========================
     REALTIME ENGAGEMENTS
  ========================== */
  useEffect(() => {
    if (!agentId) return;

    const q = query(
      collection(db, "engagements"),
      where("agentId", "==", agentId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      if (engagements.length && rows[0]?.id !== engagements[0]?.id) {
        setHighlightId(rows[0].id);
        setTimeout(() => setHighlightId(null), 2500);
      }

      setEngagements(rows);
      setLoading(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  /* =========================
     SEARCH
  ========================== */
  const filtered = useMemo(() => {
    if (!search.trim()) return engagements;
    const q = search.toLowerCase();

    return engagements.filter(e =>
      [
        e.subject,
        e.message,
        e.messageText,
        e.destinationName,
        e.spoc?.name
      ]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q))
    );
  }, [search, engagements]);

  /* =========================
     GROUP BY DATE
  ========================== */
  const grouped = useMemo(() => {
    return filtered.reduce((acc, e) => {
      const date = e.createdAt?.toDate?.() || new Date();
      const label = formatDateLabel(date);

      if (!acc[label]) acc[label] = [];
      acc[label].push(e);
      return acc;
    }, {});
  }, [filtered]);

  /* =========================
     LOADING
  ========================== */
  if (!agent || loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <HeaderSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6 pb-24">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold">
          Engagements — {agent.agencyName}
        </h1>
        <p className="text-sm text-gray-500">
          Activity timeline
        </p>
      </div>

      {/* SEARCH + JUMP */}
      <div className="flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search engagements…"
          className="border rounded-md px-3 py-2 text-sm w-full max-w-sm"
        />

        <button
          onClick={() =>
            todayRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          className="text-sm text-blue-600 hover:underline whitespace-nowrap"
        >
          Jump to Today
        </button>
      </div>

      {/* LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DESKTOP FORM */}
        {!isMobile && (
          <div className="lg:sticky lg:top-6 h-fit">
            <EngagementForm agent={agent} />
          </div>
        )}

        {/* TIMELINE */}
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No matching engagements"
              description="Try adjusting your search keywords"
            />
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(([dateLabel, items]) => {
                const collapsed =
                  collapsedDates[dateLabel] &&
                  dateLabel !== "Today";

                return (
                  <div
                    key={dateLabel}
                    ref={dateLabel === "Today" ? todayRef : null}
                  >
                    <div className="sticky top-0 bg-gray-50 z-10 py-2 flex items-center gap-3">
                      <button
                        onClick={() =>
                          setCollapsedDates(s => ({
                            ...s,
                            [dateLabel]: !s[dateLabel]
                          }))
                        }
                        className="text-xs font-semibold text-gray-600 uppercase"
                      >
                        {collapsed ? "▶" : "▼"} {dateLabel}
                      </button>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {!collapsed && (
                      <div className="space-y-6 pl-2">
                        {items.map(e => (
                          <EngagementCard
                            key={e.id}
                            engagement={e}
                            agent={agent}
                            highlight={e.id === highlightId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE ADD ENGAGEMENT */}
      {isMobile && (
        <>
          <button
            onClick={() => setFormOpen(true)}
            className="
              fixed bottom-6 right-6 z-30
              bg-blue-600 text-white
              rounded-full p-4 shadow-lg
            "
          >
            <Plus className="w-6 h-6" />
          </button>

          <BottomSheetModal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            title="New Engagement"
          >
            <EngagementForm agent={agent} />
          </BottomSheetModal>
        </>
      )}
    </main>
  );
}
