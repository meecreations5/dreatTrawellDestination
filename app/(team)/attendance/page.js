"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

import StatusBadge from "@/components/ui/StatusBadge";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { deriveAttendanceStatus } from "@/lib/deriveAttendanceStatus";

/* =========================
   HELPERS
========================= */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function toJSDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}

function formatTime(date) {
  if (!date) return "--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function minutesToHM(min = 0) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [attendance, setAttendance] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [liveMinutes, setLiveMinutes] = useState(0);

  const date = today();

  /* =========================
     AUTH
  ========================= */
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  /* =========================
     LOAD TODAY
  ========================= */
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setPageLoading(true);
      const ref = doc(db, "attendance", `${user.uid}_${date}`);
      const snap = await getDoc(ref);
      setAttendance(snap.exists() ? snap.data() : null);
      setPageLoading(false);
    };

    load();
  }, [user, date]);

  /* =========================
     DERIVED SAFE VALUES
  ========================= */
  const sessions = attendance?.sessions || [];
  const activeSession =
    sessions.find(s => !s.checkOutAt) || null;

  /* =========================
     LIVE TIMER
  ========================= */
  useEffect(() => {
    if (!activeSession) {
      setLiveMinutes(0);
      return;
    }

    const inTime = toJSDate(activeSession.checkInAt);
    if (!inTime) return;

    const update = () => {
      const mins = Math.floor(
        (Date.now() - inTime.getTime()) / 60000
      );
      setLiveMinutes(mins);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (loading || pageLoading) {
    return <PageSkeleton lines={6} />;
  }

  if (!user) return null;

  /* =========================
     CHECK IN
  ========================= */
  const checkIn = async () => {
    // 🛑 prevent double check-in
    if (activeSession) return;

    const ref = doc(db, "attendance", `${user.uid}_${date}`);

    if (!attendance) {
      await setDoc(ref, {
        uid: user.uid,
        date,
        sessions: [{ checkInAt: new Date() }],
        totalMinutes: 0,
        status: "present",
        createdAt: serverTimestamp()
      });
    } else {
      await updateDoc(ref, {
        sessions: [...sessions, { checkInAt: new Date() }],
        updatedAt: serverTimestamp()
      });
    }

    const snap = await getDoc(ref);
    setAttendance(snap.data());
  };

  /* =========================
     CHECK OUT
  ========================= */
  const checkOut = async () => {
    if (!attendance || !activeSession) return;

    const ref = doc(db, "attendance", `${user.uid}_${date}`);
    const now = new Date();

    const updatedSessions = sessions.map(s => {
      if (!s.checkOutAt) {
        const inTime = toJSDate(s.checkInAt);
        const minutes = inTime
          ? Math.floor((now - inTime) / 60000)
          : 0;
        return { ...s, checkOutAt: now, minutes };
      }
      return s;
    });

    const totalMinutes = updatedSessions.reduce(
      (sum, s) => sum + (s.minutes || 0),
      0
    );

    const status = deriveAttendanceStatus({ totalMinutes });

    await updateDoc(ref, {
      sessions: updatedSessions,
      totalMinutes,
      status,
      updatedAt: serverTimestamp()
    });

    const snap = await getDoc(ref);
    setAttendance(snap.data());
  };

  /* =========================
     UI
  ========================= */
  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6 pb-28">
      {/* HERO STATUS */}
      <div className="bg-blue-50 rounded-2xl p-5 space-y-2">
        <h1 className="text-lg font-semibold text-blue-700">
          Today’s Work Log
        </h1>

        <div className="flex items-center justify-between">
          <div>
            {activeSession ? (
              <>
                <p className="text-sm text-blue-700">
                  🟢 You’re checked in
                </p>
                <p className="text-xs text-gray-600">
                  Started at{" "}
                  {formatTime(
                    toJSDate(activeSession.checkInAt)
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                🔴 You’re not working right now
              </p>
            )}
          </div>

          <StatusBadge status={attendance?.status} />
        </div>

        {activeSession && (
          <div className="pt-2">
            <p className="text-xs text-gray-500">
              ⏱ Working time
            </p>
            <p className="text-xl font-semibold text-blue-800">
              {minutesToHM(liveMinutes)}
            </p>
          </div>
        )}
      </div>

      {/* SESSION TIMELINE */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">
          Today’s Sessions
        </h2>

        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400">
              No sessions recorded today
            </p>
          )}

          {sessions.map((s, idx) => {
            const inTime = toJSDate(s.checkInAt);
            const outTime = toJSDate(s.checkOutAt);

            return (
              <div
                key={idx}
                className="flex items-start gap-3"
              >
                <div className="mt-1 w-2 h-2 rounded-full bg-blue-600" />
                <div className="text-sm">
                  <p>
                    Check in{" "}
                    <span className="font-medium">
                      {formatTime(inTime)}
                    </span>
                  </p>

                  {outTime && (
                    <p className="text-gray-500 text-xs">
                      Check out{" "}
                      {formatTime(outTime)} •{" "}
                      {minutesToHM(s.minutes || 0)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STICKY ACTION */}
      <div className="
        fixed bottom-[72px] inset-x-0
        bg-white border-t border-gray-200
        p-4 z-20
        md:static md:border-0
      ">
        {!activeSession ? (
          <button
            onClick={checkIn}
            className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-medium transition"
          >
            Start Work
          </button>
        ) : (
          <button
            onClick={checkOut}
            className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-medium transition"
          >
            End Work
          </button>
        )}
      </div>
    </main>
  );
}
