"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";
import { generateTravelAgentCode } from "@/lib/generateTravelAgentCode";

/* =========================
   FINAL FORM SHAPE
========================= */
const EMPTY_FORM = {
  /* BASIC */
  agencyName: "",
  agentCode: "",
  agencyType: "",
  website: "",
  usp: "",
  logoUrl: "",
  status: "active",

  /* DESTINATIONS */
  destinations: [], // [{ id, name }]
  destinationIds: [],

  /* PRODUCTS */
  productTypes: [],
  avgTicketSize: "",

  /* GENERIC CONTACT */
  genericContact: {
    phone: "",
    email: ""
  },

  /* ADDRESS */
  address: {
    line1: "",
    line2: "",
    pincode: "",
    city: "",
    state: "",
    country: "India"
  },

  googleMapLink: "",

  /* SPOCS */
  spocs: [
    {
      name: "",
      email: "",
      mobile: "",
      designation: "",
      department: "",
      isPrimary: true
    }
  ],

  /* RELATIONSHIP & OWNERSHIP */
  relationshipStage: "New",
  assignedTo: "",
  accountManagerUid: "",
  team: "",

  /* COMMUNICATION */
  preferredCommunication: {
    whatsapp: true,
    email: true,
    call: false
  },
  preferredLanguage: "English",

  /* INTERNAL */
  internalNotes: "",
  strengths: [],
  weaknesses: [],

  /* COMPLIANCE */
  gstNumber: "",
  panNumber: "",
  kycStatus: "Pending"
};

const PRODUCT_TYPES = [
  "FIT",
  "Group",
  "Luxury",
  "MICE",
  "Honeymoon",
  "Adventure"
];


export default function TravelAgentFormOG({ mode, agentId }) {
  const { user } = useAuth("admin");
  const router = useRouter();
  const isEdit = mode === "edit";

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  const [allDestinations, setAllDestinations] = useState([]);

  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");


  /* =========================
   FIRESTORE SAFE CLEANER
========================= */
  const sanitizeForFirestore = obj =>
    JSON.parse(
      JSON.stringify(obj, (_, v) =>
        v === undefined ? null : v
      )
    );


  /* =========================
     LOAD AGENT (EDIT)
  ========================= */
  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const snap = await getDoc(doc(db, "travelAgents", agentId));
      if (!snap.exists()) {
        alert("Travel agent not found");
        router.replace("/admin/travel-agents");
        return;
      }

      const data = snap.data();

      setForm({
        ...EMPTY_FORM,
        ...data,
        destinations: data.destinations || [],
        destinationIds: (data.destinations || []).map(d => d.id)
      });

      setLoading(false);
    };

    load();
  }, [isEdit, agentId, router]);


  useEffect(() => {
    const loadDestinations = async () => {
      try {
        console.log("Loading destinations...");

        const snap = await getDocs(
          query(
            collection(db, "destinations"),
            where("active", "==", true)
          )
        );

        console.log("Destinations found:", snap.size);

        setAllDestinations(
          snap.docs.map(d => ({
            id: d.id,
            name: d.data().name
          }))
        );
      } catch (err) {
        console.error("Destination load error:", err);
      }
    };

    loadDestinations();
  }, []);


  /* =========================
     PINCODE LOOKUP (INDIA)
  ========================= */
  const fetchCityStateFromPincode = async pincode => {
    if (pincode.length !== 6) return;

    try {
      setAddressLoading(true);
      setAddressError("");

      const res = await fetch(
        `https://api.postalpincode.in/pincode/${pincode}`
      );
      const data = await res.json();

      if (data[0]?.Status !== "Success") {
        throw new Error("Invalid pincode");
      }

      const po = data[0].PostOffice[0];

      setForm(prev => ({
        ...prev,
        address: {
          ...prev.address,
          city: po.District,
          state: po.State,
          country: "India"
        }
      }));
    } catch {
      setAddressError("Invalid pincode");
      setForm(prev => ({
        ...prev,
        address: { ...prev.address, city: "", state: "" }
      }));
    } finally {
      setAddressLoading(false);
    }
  };

  /* =========================
     SPOC HELPERS
  ========================= */
  const addSpoc = () =>
    setForm({
      ...form,
      spocs: [
        ...form.spocs,
        {
          name: "",
          email: "",
          mobile: "",
          designation: "",
          department: "",
          isPrimary: false
        }
      ]
    });

  const setPrimarySpoc = index =>
    setForm({
      ...form,
      spocs: form.spocs.map((s, i) => ({
        ...s,
        isPrimary: i === index
      }))
    });

  const removeSpoc = index => {
    if (form.spocs.length === 1) return;
    setForm({
      ...form,
      spocs: form.spocs.filter((_, i) => i !== index)
    });
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (!form.agencyName) return alert("Agency name required");
    if (!form.address.line1) return alert("Address required");

    if (
      form.address.country === "India" &&
      (!form.address.pincode || !form.address.city)
    ) {
      return alert("Valid pincode required");
    }

    const mapQuery = [
      form.address.line1,
      form.address.city,
      form.address.state,
      form.address.country
    ]
      .filter(Boolean)
      .join(", ");

    const rawPayload = {
      ...form,

      destinations: (form.destinations || []).map(d => ({
        id: d.id,
        name: d.name || ""
      })),

      destinationIds: (form.destinations || []).map(d => d.id),

      spocs: (form.spocs || []).map(s => ({
        name: s.name || "",
        email: s.email || "",
        mobile: s.mobile || "",
        designation: s.designation || "",
        department: s.department || "",
        isPrimary: !!s.isPrimary
      })),

      googleMapLink: mapQuery
        ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}`
        : "",

      updatedAt: serverTimestamp()
    };

    const payload = sanitizeForFirestore(rawPayload);

    if (isEdit) {
      await updateDoc(
        doc(db, "travelAgents", agentId),
        payload
      );
    } else {
      await setDoc(
        doc(db, "travelAgents", crypto.randomUUID()),
        {
          ...payload,
          agentCode: await generateTravelAgentCode(),
          createdByUid: user.uid,
          createdAt: serverTimestamp()
        }
      );
    }

    router.replace("/admin/travel-agents");
  };


  if (loading) return <p className="p-6">Loading…</p>;

  const mapUrl = form.googleMapLink;

  return (
    <AdminGuard>
      <main className="p-6 max-w-5xl space-y-6">
        <h1 className="text-xl font-bold text-red-600">
          {isEdit ? "Edit" : "Add"} Travel Agent
        </h1>

        {/* ================= BASIC ================= */}
        <input
          className="border p-2 w-full"
          placeholder="Agency Name *"
          value={form.agencyName}
          onChange={e =>
            setForm({ ...form, agencyName: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Logo URL"
          value={form.logoUrl}
          onChange={e =>
            setForm({ ...form, logoUrl: e.target.value })
          }
        />


        <input
          className="border p-2 w-full"
          placeholder="Website"
          value={form.website}
          onChange={e =>
            setForm({ ...form, website: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="USP"
          value={form.usp}
          onChange={e =>
            setForm({ ...form, usp: e.target.value })
          }
        />


        <select
          className="border p-2 w-full"
          value={form.agencyType}
          onChange={e =>
            setForm({ ...form, agencyType: e.target.value })
          }
        >
          <option value="">Select Agency Type</option>
          <option value="DMC">DMC</option>
          <option value="B2B Agent">B2B Agent</option>
          <option value="Corporate">Corporate</option>
          <option value="Retail">Retail</option>
        </select>


        <h2 className="font-semibold">Generic Contact</h2>

        <input
          className="border p-2 w-full"
          placeholder="Phone"
          value={form.genericContact.phone}
          onChange={e =>
            setForm({
              ...form,
              genericContact: {
                ...form.genericContact,
                phone: e.target.value
              }
            })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Email"
          value={form.genericContact.email}
          onChange={e =>
            setForm({
              ...form,
              genericContact: {
                ...form.genericContact,
                email: e.target.value
              }
            })
          }
        />


        {/* ================= DESTINATIONS ================= */}
        <h2 className="font-semibold">Destinations</h2>

        <div className="flex flex-wrap gap-3">
          {allDestinations.map(d => {
            const checked = form.destinationIds.includes(d.id);
            return (
              <label key={d.id} className="text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    const destinations = e.target.checked
                      ? [...form.destinations, d]
                      : form.destinations.filter(
                        x => x.id !== d.id
                      );

                    setForm({
                      ...form,
                      destinations,
                      destinationIds: destinations.map(x => x.id)
                    });
                  }}
                />{" "}
                {d.name}
              </label>
            );
          })}
        </div>

        {/* ================= PRODUCT TYPES ================= */}
        <h2 className="font-semibold">Product Types</h2>

        <div className="flex flex-wrap gap-3">
          {PRODUCT_TYPES.map(p => (
            <label key={p} className="text-sm">
              <input
                type="checkbox"
                checked={form.productTypes.includes(p)}
                onChange={e =>
                  setForm({
                    ...form,
                    productTypes: e.target.checked
                      ? [...form.productTypes, p]
                      : form.productTypes.filter(x => x !== p)
                  })
                }
              />{" "}
              {p}
            </label>
          ))}
        </div>


        <input
          type="number"
          className="border p-2 w-full"
          placeholder="Average Ticket Size"
          value={form.avgTicketSize}
          onChange={e =>
            setForm({ ...form, avgTicketSize: e.target.value })
          }
        />

        {/* ================= ADDRESS ================= */}
        <h2 className="font-semibold">Address</h2>

        <input
          className="border p-2 w-full"
          placeholder="Address Line 1"
          value={form.address.line1}
          onChange={e =>
            setForm({
              ...form,
              address: { ...form.address, line1: e.target.value }
            })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Address Line 2"
          value={form.address.line2}
          onChange={e =>
            setForm({
              ...form,
              address: { ...form.address, line2: e.target.value }
            })
          }
        />

        {form.address.country === "India" && (
          <>
            <input
              className="border p-2 w-full"
              placeholder="Pincode"
              value={form.address.pincode}
              onChange={e =>
                setForm({
                  ...form,
                  address: {
                    ...form.address,
                    pincode: e.target.value
                  }
                })
              }
              onBlur={e =>
                fetchCityStateFromPincode(e.target.value)
              }
            />

            {addressLoading && (
              <p className="text-xs text-blue-600">
                Fetching city/state…
              </p>
            )}
            {addressError && (
              <p className="text-xs text-red-600">
                {addressError}
              </p>
            )}
          </>
        )}

        <select
          className="border p-2 w-full"
          value={form.relationshipStage}
          onChange={e =>
            setForm({ ...form, relationshipStage: e.target.value })
          }
        >
          <option value="New">New</option>
          <option value="Active">Active</option>
          <option value="Preferred">Preferred</option>
          <option value="Strategic">Strategic</option>
          <option value="Dormant">Dormant</option>
        </select>

        <select
          className="border p-2 w-full"
          value={form.agencyType}
          onChange={e =>
            setForm({ ...form, agencyType: e.target.value })
          }
        >
          <option value="">Select Agency Type</option>
          <option value="DMC">DMC</option>
          <option value="B2B Agent">B2B Agent</option>
          <option value="Corporate">Corporate</option>
          <option value="Retail">Retail</option>
        </select>


        <select
          className="border p-2 w-full"
          value={form.preferredLanguage}
          onChange={e =>
            setForm({ ...form, preferredLanguage: e.target.value })
          }
        >
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
        </select>

        <input
          className="border p-2 w-full"
          placeholder="Strengths (comma separated)"
          value={form.strengths.join(", ")}
          onChange={e =>
            setForm({
              ...form,
              strengths: e.target.value
                .split(",")
                .map(v => v.trim())
                .filter(Boolean)
            })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Weaknesses (comma separated)"
          value={form.weaknesses.join(", ")}
          onChange={e =>
            setForm({
              ...form,
              weaknesses: e.target.value
                .split(",")
                .map(v => v.trim())
                .filter(Boolean)
            })
          }
        />

        <select
          className="border p-2 w-full"
          value={form.address.country}
          onChange={e =>
            setForm({
              ...form,
              address: {
                ...form.address,
                country: e.target.value,
                city: "",
                state: "",
                pincode: ""
              }
            })
          }
        >
          <option value="India">India</option>
          <option value="Other">Other</option>
        </select>


        <input
          className="border p-2 w-full"
          placeholder="City"
          disabled={form.address.country === "India"}
          value={form.address.city}
          onChange={e =>
            setForm({
              ...form,
              address: {
                ...form.address,
                city: e.target.value
              }
            })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="State"
          disabled={form.address.country === "India"}
          value={form.address.state}
          onChange={e =>
            setForm({
              ...form,
              address: {
                ...form.address,
                state: e.target.value
              }
            })
          }
        />

        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            className="text-sm text-blue-600 underline"
          >
            📍 View on Google Maps
          </a>
        )}

        {/* ================= SPOCS ================= */}
        <h2 className="font-semibold">SPOCs</h2>

        {form.spocs.map((s, i) => (
          <div key={i} className="border p-3 rounded">
            <div className="grid grid-cols-2 gap-2">
              {[
                "name",
                "email",
                "mobile",
                "designation",
                "department"
              ].map(f => (
                <input
                  key={f}
                  className="border p-2"
                  placeholder={f}
                  value={s[f]}
                  onChange={e => {
                    const spocs = [...form.spocs];
                    spocs[i][f] = e.target.value;
                    setForm({ ...form, spocs });
                  }}
                />
              ))}
            </div>

            <div className="flex gap-4 mt-2">
              <label className="text-sm">
                <input
                  type="radio"
                  checked={s.isPrimary}
                  onChange={() => setPrimarySpoc(i)}
                />{" "}
                Primary
              </label>

              {form.spocs.length > 1 && (
                <button
                  onClick={() => removeSpoc(i)}
                  className="text-red-600 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={addSpoc}
          className="text-blue-600 text-sm underline"
        >
          + Add SPOC
        </button>

        {/* ================= INTERNAL NOTES ================= */}
        <h2 className="font-semibold">Internal Notes</h2>

        <textarea
          className="border p-2 w-full"
          placeholder="Internal notes"
          value={form.internalNotes}
          onChange={e =>
            setForm({ ...form, internalNotes: e.target.value })
          }
        />

        <select
          className="border p-2 w-full"
          value={form.status}
          onChange={e =>
            setForm({ ...form, status: e.target.value })
          }
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>


        <button
          onClick={save}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          Save Travel Agent
        </button>
      </main>
    </AdminGuard>
  );
}
