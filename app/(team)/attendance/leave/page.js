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
import { Plus } from "lucide-react";

export default function ApplyLeave() {
  const { user } = useAuth();

  /* ================= FORM ================= */
  const [form, setForm] = useState({
    type: "casual",
    startDate: "",
    endDate: "",
    reason: ""
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  /* ================= HISTORY ================= */
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [month, setMonth] = useState("");

  /* ================= MOBILE ================= */
  const [showFormMobile, setShowFormMobile] = useState(false);

  /* ================= LOAD HISTORY ================= */
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const snap = await getDocs(
        query(
          collection(db, "leaves"),
          where("uid", "==", user.uid),
          orderBy("appliedAt", "desc")
        )
      );

      let data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      if (month) {
        data = data.filter(l => l.fromDate?.startsWith(month));
      }

      setHistory(data);
      setLoading(false);
    };

    load();
  }, [user, month]);

  /* ================= VALIDATION ================= */
  const validate = () => {
    const e = {};
    if (!form.startDate) e.startDate = "Start date required";
    if (!form.endDate) e.endDate = "End date required";
    if (!form.reason || form.reason.length < 10)
      e.reason = "Minimum 10 characters required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ================= SUBMIT ================= */
  const submit = async () => {
    if (!validate()) return;

    setSubmitting(true);

    await addDoc(collection(db, "leaves"), {
      uid: user.uid,
      employeeId: user.employeeId || "",
      name: user.name || "",
      email: user.email || "",

      type: form.type,
      fromDate: form.startDate,
      toDate: form.endDate,
      reason: form.reason,

      status: "pending",
      appliedAt: serverTimestamp(),

      actionBy: null,
      actionAt: null,
      adminRemark: null
    });

    setShowFormMobile(false);
    setForm({
      type: "casual",
      startDate: "",
      endDate: "",
      reason: ""
    });
  };

  /* ================= CANCEL ================= */
  const cancelLeave = async (id) => {
    const ok = confirm("Cancel this leave request?");
    if (!ok) return;

    await updateDoc(doc(db, "leaves", id), {
      status: "cancelled",
      cancelledAt: serverTimestamp()
    });

    setHistory(prev =>
      prev.map(l =>
        l.id === id ? { ...l, status: "cancelled" } : l
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
            Leave Management
          </h1>
          <p className="text-sm text-slate-500">
            Apply for leave and track previous requests
          </p>
        </header>

        {/* DESKTOP */}
        <div className="hidden lg:grid grid-cols-3 gap-6">
          <LeaveForm
            {...{ form, setForm, errors, submit, inputClass, submitting }}
          />
          <LeaveHistory
            {...{
              history,
              loading,
              expandedId,
              setExpandedId,
              month,
              setMonth,
              inputClass,
              cancelLeave
            }}
          />
        </div>

        {/* MOBILE HISTORY */}
        <div className="lg:hidden">
          <LeaveHistory
            {...{
              history,
              loading,
              expandedId,
              setExpandedId,
              month,
              setMonth,
              inputClass,
              cancelLeave
            }}
          />
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowFormMobile(true)}
        className="lg:hidden fixed bottom-20 right-4 bg-blue-600 text-white rounded-full p-4 shadow-lg active:scale-95 transition"
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
              <LeaveForm
                {...{
                  form,
                  setForm,
                  errors,
                  submit,
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

function LeaveForm({ form, setForm, errors, submit, inputClass, submitting }) {
  return (
    <section className="bg-white rounded-lg ring-1 ring-slate-200 p-4 space-y-4 lg:sticky lg:top-6">
      <Field label="Leave type">
        <select
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value })}
          className={inputClass}
        >
          <option value="casual">Casual</option>
          <option value="sick">Sick</option>
          <option value="planned">Planned</option>
        </select>
      </Field>

      <Field label="Start date" error={errors.startDate}>
        <input
          type="date"
          value={form.startDate}
          onChange={e =>
            setForm({ ...form, startDate: e.target.value })
          }
          className={inputClass}
        />
      </Field>

      <Field label="End date" error={errors.endDate}>
        <input
          type="date"
          value={form.endDate}
          onChange={e =>
            setForm({ ...form, endDate: e.target.value })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Reason" error={errors.reason}>
        <textarea
          rows={3}
          value={form.reason}
          onChange={e =>
            setForm({ ...form, reason: e.target.value })
          }
          className={inputClass}
        />
      </Field>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Apply Leave"}
      </button>
    </section>
  );
}

function LeaveHistory({
  history,
  loading,
  expandedId,
  setExpandedId,
  month,
  setMonth,
  inputClass,
  cancelLeave
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
        {loading ? (
          <HistorySkeleton />
        ) : history.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No leave requests found
          </p>
        ) : (
          history.map(l => (
            <div key={l.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setExpandedId(expandedId === l.id ? null : l.id)
                }
                className="w-full px-4 py-3 flex justify-between items-center text-sm hover:bg-slate-50 cursor-pointer"
              >
                <div>
                  <p className="text-slate-900">
                    {l.fromDate} → {l.toDate}
                  </p>
                  <p className="text-xs text-slate-500">
                    {l.type}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={l.status} />

                  {l.status === "pending" && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        cancelLeave(l.id);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {expandedId === l.id && l.adminRemark && (
                <div className="pl-4 pr-4 pb-3 border-l border-slate-200 text-xs text-slate-600">
                  Admin remark: {l.adminRemark}
                </div>
              )}

              {expandedId === l.id && l.status === "cancelled" && (
                <div className="pl-4 pr-4 pb-3 border-l border-slate-200 text-xs text-slate-500">
                  Cancelled by you
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
        <p className="text-xs text-rose-600 mt-1">{error}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    approved: "bg-green-50 text-green-700 border-green-100",
    rejected: "bg-rose-50 text-rose-700 border-rose-100",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200"
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
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="h-2 w-20 bg-slate-200 rounded" />
          </div>
          <div className="h-5 w-16 bg-slate-200 rounded" />
        </div>
      ))}
    </>
  );
}
