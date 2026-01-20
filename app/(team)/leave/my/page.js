// leave/my/page.js

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function MyLeavesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const q = query(
        collection(db, "leaves"),
        where("uid", "==", user.uid),
        orderBy("appliedAt", "desc")
      );

      const snap = await getDocs(q);
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    load();
  }, [user]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) return null;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-red-600">
        My Leaves
      </h1>

      <div className="mt-4 space-y-3">
        {leaves.map(l => (
          <div
            key={l.id}
            className="bg-white p-3 rounded shadow"
          >
            <p className="font-semibold">
              {l.fromDate} → {l.toDate}
            </p>
            <p className="text-sm">
              Type: {l.type}
            </p>
            <p className="text-sm">
              Status:{" "}
              <b className={
                l.status === "approved"
                  ? "text-green-600"
                  : l.status === "rejected"
                  ? "text-red-600"
                  : "text-yellow-600"
              }>
                {l.status}
              </b>
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
