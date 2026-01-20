"use client";

import { useState } from "react";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateTravelAgentCode } from "@/lib/generateTravelAgentCode";

export default function TravelAgentImportCSV({ onImported }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const parseCsv = text => {
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i]?.replace(/^"|"$/g, "") || "";
      });
      return obj;
    });
  };

  const onFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const data = parseCsv(ev.target.result);
      setRows(data);
    };
    reader.readAsText(file);
  };

  const importData = async () => {
    if (rows.length === 0) {
      alert("No data to import");
      return;
    }

    setLoading(true);

    try {
      for (const r of rows) {
        if (!r["Agency Name"]) continue;

        const id = crypto.randomUUID();

        await setDoc(doc(db, "travelAgents", id), {
          agencyName: r["Agency Name"],
          agentCode: await generateTravelAgentCode(),
          agencyType: r["Agency Type"] || "",
          website: r["Website"] || "",
          status: r["Status"] || "active",

          genericContact: {
            phone: r["Phone"] || "",
            email: r["Email"] || ""
          },

          address: {
            city: r["City"] || "",
            state: r["State"] || "",
            country: r["Country"] || "India"
          },

          spocs: [
            {
              name: r["SPOC Name"] || "",
              email: r["SPOC Email"] || "",
              mobile: r["SPOC Mobile"] || "",
              isPrimary: true
            }
          ],

          createdAt: serverTimestamp(),
          importedAt: serverTimestamp(),
          importSource: "csv"
        });
      }

      alert("Import completed");
      onImported?.();
      setRows([]);
    } catch (err) {
      console.error(err);
      alert("Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-4">
      <input
        type="file"
        accept=".csv"
        onChange={onFileChange}
      />

      {rows.length > 0 && (
        <>
          <p className="text-sm text-gray-600">
            Preview ({rows.length} records)
          </p>

          <div className="max-h-40 overflow-auto border text-xs">
            <table className="w-full">
              <thead>
                <tr>
                  {Object.keys(rows[0]).map(h => (
                    <th key={h} className="border px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td
                        key={j}
                        className="border px-2 py-1"
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={importData}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {loading ? "Importing..." : "Confirm Import"}
          </button>
        </>
      )}
    </div>
  );
}
