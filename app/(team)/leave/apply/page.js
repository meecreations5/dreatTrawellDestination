// leave/apply/page.js
"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function ApplyLeavePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    fromDate: "",
    toDate: "",
    type: "casual",
    reason: ""
  });

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) {
    router.replace("/login");
    return null;
  }

  const apply = async () => {
    if (!form.fromDate || !form.toDate) {
      alert("Select leave dates");
      return;
    }

    await addDoc(collection(db, "leaves"), {
      uid: user.uid,
      employeeId: user.employeeId,
      name: user.name,

      fromDate: form.fromDate,
      toDate: form.toDate,
      type: form.type,
      reason: form.reason,

      status: "pending",
      appliedAt: serverTimestamp(),

      actionBy: null,
      actionAt: null,
      adminRemark: null
    });


    alert("Leave applied successfully");
    router.replace("/leave/my");
  };

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-red-600">
        Apply Leave
      </h1>

      <input
        type="date"
        className="border p-2 rounded w-full mt-3"
        value={form.fromDate}
        onChange={e =>
          setForm({ ...form, fromDate: e.target.value })
        }
      />

      <input
        type="date"
        className="border p-2 rounded w-full mt-2"
        value={form.toDate}
        onChange={e =>
          setForm({ ...form, toDate: e.target.value })
        }
      />

      <select
        className="border p-2 rounded w-full mt-2"
        value={form.type}
        onChange={e =>
          setForm({ ...form, type: e.target.value })}
      >
        <option value="casual">Casual Leave</option>
        <option value="sick">Sick Leave</option>
        <option value="other">Other</option>
      </select>

      <textarea
        className="border p-2 rounded w-full mt-2"
        placeholder="Reason"
        value={form.reason}
        onChange={e =>
          setForm({ ...form, reason: e.target.value })}
      />

      <button
        onClick={apply}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        Apply Leave
      </button>
    </main>
  );
}
