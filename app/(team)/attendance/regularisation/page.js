"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  updateDoc,
  doc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function RegularizePage() {
  const { user } = useAuth();
  const router = useRouter();

  /* ================= FORM ================= */
  const [form, setForm] = useState({
    date: "",
    type: "",
    checkIn: "",
    checkOut: "",
    reason: ""
  });

  const [errors, setErrors] = useState({});
  const [blockedMsg, setBlockedMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ================= HISTORY ================= */
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [month, setMonth] = useState("");

  /* ================= MOBILE ================= */
  const [showFormMobile, setShowFormMobile] = useState(false);

  /* ================= DATE INTELLIGENCE ================= */
  useEffect(() => {
    if (!form.date || !user) return;

    const check = async () => {
      setBlockedMsg("");

      const leaveSnap = await getDocs(
        query(
          collection(db, "leaves"),
          where("uid", "==", user.uid),
          where("status", "==", "approved"),
          where("fromDate", "<=", form.date),
          where("toDate", ">=", form.date)
        )
      );

      if (!leaveSnap.empty) {
        setBlockedMsg("Approved leave already exists for this date");
        return;
      }

      const dupSnap = await getDocs(
        query(
          collection(db, "regularizations"),
          where("uid", "==", user.uid),
          where("date", "==", form.date)
        )
      );

      if (!dupSnap.empty) {
        setBlockedMsg("Regularization already submitted for this date");
      }
    };

    check();
  }, [form.date, user]);

  /* ================= LOAD HISTORY ================= */
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setHistoryLoading(true);

      const snap = await getDocs(
        query(
          collection(db, "regularizations"),
          where("uid", "==", user.uid),
          orderBy("appliedAt", "desc")
        )
      );

      let data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      if (month) {
        data = data.filter(r => r.date?.startsWith(month));
      }

      setHistory(data);
      setHistoryLoading(false);
    };

    load();
  }, [user, month]);

  /* ================= VALIDATION ================= */
  const validate = () => {
    const e = {};

    if (!form.date) e.date = "Date required";
    if (!form.type) e.type = "Select reason";
    if (!form.reason || form.reason.length < 20)
      e.reason = "Minimum 20 characters";

    if (
      (form.type === "missed_checkin" ||
        form.type === "forgot_attendance") &&
      !form.checkIn
    )
      e.checkIn = "Required";

    if (
      (form.type === "missed_checkout" ||
        form.type === "forgot_attendance") &&
      !form.checkOut
    )
      e.checkOut = "Required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ================= SUBMIT ================= */
  const submit = async () => {
    if (blockedMsg) return;
    if (!validate()) return;

    setSubmitting(true);

    await addDoc(collection(db, "regularizations"), {
      uid: user.uid,
      employeeId: user.employeeId,
      name: user.name,
      ...form,
      checkInTime: form.checkIn || null,
      checkOutTime: form.checkOut || null,
      status: "pending",
      appliedAt: serverTimestamp(),
      actionBy: null,
      actionAt: null,
      adminRemark: null
    });

    router.replace("/attendance/monthly");
  };

  /* ================= REVOKE ================= */
  const revokeRequest = async (id) => {
    const ok = confirm(
      "Are you sure you want to revoke this request?"
    );
    if (!ok) return;

    await updateDoc(doc(db, "regularizations", id), {
      status: "revoked",
      revokedAt: serverTimestamp()
    });

    setHistory(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: "revoked" } : r
      )
    );
  };

  const inputClass = `
    w-full rounded-md border border-slate-200
    px-3 py-2 text-sm
    focus:border-blue-300 focus:ring-1 focus:ring-blue-200
    focus:outline-none
  `;

  return (
    <main className="px-4 py-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-lg font-semibold text-slate-900">
            Attendance Regularization
          </h1>
          <p className="text-sm text-slate-500">
            Create requests and track approval history
          </p>
        </header>

        {/* DESKTOP */}
        <div className="hidden lg:grid grid-cols-3 gap-6">
          <FormSection
            {...{
              form,
              setForm,
              errors,
              submit,
              blockedMsg,
              inputClass,
              submitting
            }}
          />

          <HistorySection
            {...{
              history,
              historyLoading,
              expandedId,
              setExpandedId,
              month,
              setMonth,
              inputClass,
              revokeRequest
            }}
          />
        </div>

        {/* MOBILE HISTORY */}
        <div className="lg:hidden">
          <HistorySection
            {...{
              history,
              historyLoading,
              expandedId,
              setExpandedId,
              month,
              setMonth,
              inputClass,
              revokeRequest
            }}
          />
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowFormMobile(true)}
        className="lg:hidden fixed bottom-18 right-4 bg-blue-600 text-white rounded-full p-4 shadow-lg active:scale-95 transition"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* MOBILE BOTTOM SHEET */}
      {showFormMobile && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowFormMobile(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl max-h-[85vh] overflow-y-auto transition-transform duration-300 ease-out">
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="p-4">
              <FormSection
                {...{
                  form,
                  setForm,
                  errors,
                  submit,
                  blockedMsg,
                  inputClass,
                  submitting
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================= SUB COMPONENTS ================= */

function FormSection({
  form,
  setForm,
  errors,
  submit,
  blockedMsg,
  inputClass,
  submitting
}) {
  const showCheckIn =
    form.type === "missed_checkin" ||
    form.type === "forgot_attendance";

  const showCheckOut =
    form.type === "missed_checkout" ||
    form.type === "forgot_attendance";

  return (
    <section className="bg-white rounded-lg ring-1 ring-slate-200 p-4 space-y-4 lg:sticky lg:top-6">
      {blockedMsg && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm">
          {blockedMsg}
        </div>
      )}

      <Field label="Date" error={errors.date}>
        <input
          type="date"
          value={form.date}
          onChange={e =>
            setForm({ ...form, date: e.target.value })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Reason" error={errors.type}>
        <select
          value={form.type}
          onChange={e =>
            setForm({ ...form, type: e.target.value })
          }
          className={inputClass}
        >
          <option value="">Select reason</option>
          <option value="missed_checkin">Missed check-in</option>
          <option value="missed_checkout">Missed check-out</option>
          <option value="forgot_attendance">Forgot attendance</option>
        </select>
      </Field>

      {(showCheckIn || showCheckOut) && (
        <div className="grid grid-cols-2 gap-3">
          {showCheckIn && (
            <Field label="Check-in time" error={errors.checkIn}>
              <input
                type="time"
                value={form.checkIn}
                onChange={e =>
                  setForm({
                    ...form,
                    checkIn: e.target.value
                  })
                }
                className={inputClass}
              />
            </Field>
          )}

          {showCheckOut && (
            <Field label="Check-out time" error={errors.checkOut}>
              <input
                type="time"
                value={form.checkOut}
                onChange={e =>
                  setForm({
                    ...form,
                    checkOut: e.target.value
                  })
                }
                className={inputClass}
              />
            </Field>
          )}
        </div>
      )}

      <Field label="Explanation" error={errors.reason}>
        <textarea
          rows={3}
          value={form.reason}
          onChange={e =>
            setForm({ ...form, reason: e.target.value })
          }
          className={inputClass}
        />
        <p className="text-xs text-slate-400 mt-1">
          {form.reason.length} / 20
        </p>
      </Field>

      <button
        onClick={submit}
        disabled={submitting || !!blockedMsg}
        className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Request"}
      </button>
    </section>
  );
}

function HistorySection({
  history,
  historyLoading,
  expandedId,
  setExpandedId,
  month,
  setMonth,
  inputClass,
  revokeRequest
}) {
  return (
    <section className="col-span-2 space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className="text-xs text-slate-500 block mb-1">
          Filter by month
        </label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {historyLoading ? (
          <HistorySkeleton />
        ) : history.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No requests found
          </p>
        ) : (
          history.map(r => (
            <div key={r.id}>
              {/* ROW */}
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setExpandedId(expandedId === r.id ? null : r.id)
                }
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    setExpandedId(expandedId === r.id ? null : r.id);
                  }
                }}
                className="w-full px-4 py-3 flex justify-between items-center text-sm hover:bg-slate-50 cursor-pointer"
              >
                <div className="text-left">
                  <p className="text-slate-900">{r.date}</p>
                  <p className="text-xs text-slate-500">
                    {r.type?.replace("_", " ")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />

                  {r.status === "pending" && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        revokeRequest(r.id);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* EXPANDED */}
              {expandedId === r.id && r.adminRemark && (
                <div className="pl-4 pr-4 pb-3 border-l border-slate-200 text-xs text-slate-600">
                  Admin remark: {r.adminRemark}
                </div>
              )}

              {expandedId === r.id && r.status === "revoked" && (
                <div className="pl-4 pr-4 pb-3 border-l border-slate-200 text-xs text-slate-500">
                  Request cancelled by you
                </div>
              )}
            </div>

          ))
        )}
      </div>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    approved: "bg-green-50 text-green-700 border-green-100",
    rejected: "bg-rose-50 text-rose-700 border-rose-100",
    revoked: "bg-slate-100 text-slate-600 border-slate-200"
  };

  return (
    <span className={`text-xs px-2 py-1 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

function HistorySkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 animate-pulse flex justify-between"
        >
          <div className="space-y-2">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-2 w-32 bg-slate-200 rounded" />
          </div>
          <div className="h-5 w-16 bg-slate-200 rounded" />
        </div>
      ))}
    </>
  );
}
