//engagementId/[engangementId]/page.js

"use client";
import EngagementStatusFilters from "@/components/engagement/EngagementStatusFilters";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function EngagementDetailPage() {
  const { engagementId } = useParams();
  const [engagement, setEngagement] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    getDoc(doc(db, "engagements", engagementId)).then(snap => {
      if (snap.exists()) {
        setEngagement({ id: snap.id, ...snap.data() });
      }
    });
  }, [engagementId]);

  if (!engagement) return null;

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">
        Engagement Detail
      </h1>

      <div className="bg-white p-4 rounded shadow space-y-2">
        <p><b>Channel:</b> {engagement.channel}</p>
        <p><b>To:</b> {engagement.spoc.name}</p>
        <p><b>Destination:</b> {engagement.destinationName || "—"}</p>
        <p><b>Created By:</b> {engagement.createdByName}</p>

        {engagement.subject && (
          <p><b>Subject:</b> {engagement.subject}</p>
        )}

        <div className="mt-4">
          <p className="font-semibold mb-2">Message</p>

          {engagement.channel === "email" ? (
            <div
              className="border p-3 bg-gray-50"
              dangerouslySetInnerHTML={{
                __html: engagement.messageHtml
              }}
            />
          ) : (
            <pre className="whitespace-pre-wrap bg-gray-50 p-3 border">
              {engagement.message}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
