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
import { checkDuplicateAgent, normalize } from "@/lib/checkDuplicateAgent";

/* =========================
   FORM SHAPE (SOURCE OF TRUTH)
========================= */
const EMPTY_FORM = {
  agencyName: "",
  agencyType: "",
  website: "",
  usp: "",
  logoUrl: "",
  status: "active",

  destinations: [],
  destinationIds: [],

  productTypes: [],
  avgTicketSize: "",

  genericContact: { phone: "", email: "" },

  address: {
    line1: "",
    line2: "",
    pincode: "",
    city: "",
    state: "",
    country: "India"
  },

  googleMapLink: "",

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

  relationshipStage: "New",
  assignedTo: "",
  accountManagerUid: "",
  team: "",

  preferredCommunication: {
    whatsapp: true,
    email: true,
    call: false
  },
  preferredLanguage: "English",

  strengths: [],
  weaknesses: [],
  internalNotes: "",

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

/* =========================
   UI PRIMITIVES (DESTINATION DESIGN)
========================= */
const Input = ({ value, ...props }) => (
  <input
    {...props}
    value={value ?? ""}
    className="
      border border-gray-200 rounded-md
      px-3 py-2 text-sm w-full
      focus:outline-none focus:ring-2 focus:ring-blue-100
    "
  />
);


const Select = props => (
  <select
    {...props}
    className="
      border border-gray-200 rounded-md
      px-3 py-2 text-sm w-full bg-white
      focus:outline-none focus:ring-2 focus:ring-blue-100
    "
  />
);

function Chip({ label, onRemove }) {
  if (!label) return null;
  return (
    <span className="
      px-2.5 py-0.5 rounded-full text-xs font-medium
      bg-blue-50 text-blue-700 border border-blue-100
      inline-flex items-center gap-1
    ">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="text-blue-600">×</button>
      )}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white p-5 rounded-lg shadow-mui animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-9 bg-gray-200 rounded" />
      <div className="h-9 bg-gray-200 rounded" />
    </div>
  );
}



/* =========================
   COMPONENT
========================= */
export default function TravelAgentForm({ mode, agentId }) {
  const { user } = useAuth("admin");
  const router = useRouter();
  const isEdit = mode === "edit";

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [allDestinations, setAllDestinations] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");



  const sanitize = obj =>
    JSON.parse(JSON.stringify(obj, (_, v) => v ?? null));


  /* ================= LOAD ================= */
  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }

    getDoc(doc(db, "travelAgents", agentId)).then(snap => {
      if (!snap.exists()) return router.replace("/admin/travel-agents");

      const d = snap.data();
      setForm({
        ...EMPTY_FORM,
        ...d,
        destinations: d.destinations || [],
        destinationIds: (d.destinations || []).map(x => x.id)
      });
      setLoading(false);
    });
  }, [isEdit, agentId, router]);

  useEffect(() => {
    getDocs(
      query(collection(db, "destinations"), where("active", "==", true))
    ).then(snap =>
      setAllDestinations(
        snap.docs.map(d => ({ id: d.id, name: d.data().name }))
      )
    );
  }, []);


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


  /* ================= SAVE ================= */
  const save = async () => {
    if (!form.agencyName) {
      alert("Agency name required");
      return;
    }

    // normalize generic contact values
    const phone = normalize(form.genericContact.phone);
    const email = normalize(form.genericContact.email);

    // duplicate check (ONLY generic contact)
    const isDuplicate = await checkDuplicateAgent(
      phone,
      email,
      isEdit ? agentId : null // allow same doc in edit mode
    );

    if (isDuplicate) {
      alert(
        "Duplicate Travel Agent detected.\n\nGeneric contact mobile or email already exists."
      );
      return;
    }

    // build payload
    const payload = sanitize({
      ...form,
      genericContact: {
        phone,
        email
      },
      destinations: form.destinations,
      destinationIds: form.destinations.map(d => d.id),
      avgTicketSize: form.avgTicketSize
        ? Number(form.avgTicketSize)
        : null,
      updatedAt: serverTimestamp()
    });

    // save to Firestore
    if (isEdit) {
      await updateDoc(doc(db, "travelAgents", agentId), payload);
    } else {
      await setDoc(doc(collection(db, "travelAgents")), {
        ...payload,
        agentCode: await generateTravelAgentCode(),
        createdByUid: user.uid,
        createdAt: serverTimestamp()
      });
    }

    router.replace("/admin/travel-agents");
  };


  if (loading) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }

  /* ================= UI ================= */
  return (
    <AdminGuard>
      <main className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* HEADER */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEdit ? "Edit" : "Add"} Travel Agent
            </h1>
          </div>

          {/* BASIC INFO */}
          <Section title="Basic Information">
            <Grid>
              <Input placeholder="Agency Name *"
                value={form.agencyName}
                onChange={e => setForm({ ...form, agencyName: e.target.value })}
              />
              <Select
                value={form.agencyType}
                onChange={e => setForm({ ...form, agencyType: e.target.value })}
              >
                <option value="">Agency Type</option>
                <option>DMC</option>
                <option>B2B Agent</option>
                <option>Corporate</option>
                <option>Retail</option>
              </Select>
              <Input placeholder="Website" value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
              />
              <Input placeholder="USP" value={form.usp}
                onChange={e => setForm({ ...form, usp: e.target.value })}
              />
              <Input placeholder="Logo URL" value={form.logoUrl}
                onChange={e => setForm({ ...form, logoUrl: e.target.value })}
              />
              <Select value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Grid>
          </Section>

          {/* DESTINATIONS */}
          <Section title="Destinations">
            <div className="flex flex-wrap gap-2 mb-3">
              {form.destinations.map(d => (
                <Chip key={d.id || `${d.name}-${Math.random()}`} label={d.name}
                  onRemove={() => {
                    const dest = form.destinations.filter(x => x.id !== d.id);
                    setForm({ ...form, destinations: dest, destinationIds: dest.map(x => x.id) });
                  }}
                />
              ))}
            </div>

            <Grid cols={3}>
              {allDestinations.map(d => (
                <label key={d.id} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.destinationIds.includes(d.id)}
                    onChange={e => {
                      const dest = e.target.checked
                        ? [...form.destinations, d]
                        : form.destinations.filter(x => x.id !== d.id);
                      setForm({ ...form, destinations: dest, destinationIds: dest.map(x => x.id) });
                    }}
                  />
                  {d.name}
                </label>
              ))}
            </Grid>
          </Section>

          {/* PRODUCTS */}
          <Section title="Products">
            <Grid cols={3}>
              {PRODUCT_TYPES.map(p => (
                <label key={p} className="flex gap-2 text-sm">
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
                  />
                  {p}
                </label>
              ))}
            </Grid>

            <Input
              placeholder="Average Ticket Size"
              type="number"
              value={form.avgTicketSize}
              onChange={e =>
                setForm({ ...form, avgTicketSize: e.target.value })
              }
            />
          </Section>

          {/* GENERIC CONTACT */}
          <Section title="Generic Contact">
            <Grid>
              <Input placeholder="Phone"
                value={form.genericContact.phone}
                onChange={e =>
                  setForm({
                    ...form,
                    genericContact: { ...form.genericContact, phone: e.target.value }
                  })
                }
              />
              <Input placeholder="Email"
                value={form.genericContact.email}
                onChange={e =>
                  setForm({
                    ...form,
                    genericContact: { ...form.genericContact, email: e.target.value }
                  })
                }
              />
            </Grid>
          </Section>


          {/* ================= SPOCS ================= */}
          <Section title="SPOCs (Points of Contact)">

            {(form.spocs || []).map((spoc, index) => (
              <SpocCard
                key={index}
                spoc={spoc}
                index={index}
                isOnlyOne={form.spocs.length === 1}

                onChange={(field, value) => {
                  const spocs = [...form.spocs];
                  spocs[index] = { ...spocs[index], [field]: value };
                  setForm({ ...form, spocs });
                }}

                onRemove={() => {
                  if (form.spocs.length === 1) return;

                  let spocs = form.spocs.filter((_, i) => i !== index);

                  // ✅ ensure one primary always exists
                  if (!spocs.some(s => s.isPrimary)) {
                    spocs[0].isPrimary = true;
                  }

                  setForm({ ...form, spocs });
                }}

                onSetPrimary={() => {
                  const spocs = form.spocs.map((s, i) => ({
                    ...s,
                    isPrimary: i === index
                  }));
                  setForm({ ...form, spocs });
                }}
              />
            ))}

            {/* ADD SPOC */}
            <button
              type="button"
              onClick={() =>
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
                })
              }
              className="
      text-sm text-blue-600
      hover:underline
      font-medium
    "
            >
              + Add SPOC
            </button>

          </Section>


          {/* ================= RELATIONSHIP & OWNERSHIP ================= */}
          <Section title="Relationship & Ownership">

            <Grid>
              {/* RELATIONSHIP STAGE */}
              <Select
                value={form.relationshipStage}
                onChange={e =>
                  setForm({
                    ...form,
                    relationshipStage: e.target.value
                  })
                }
              >
                <option value="New">New</option>
                <option value="Active">Active</option>
                <option value="Preferred">Preferred</option>
                <option value="Strategic">Strategic</option>
                <option value="Dormant">Dormant</option>
              </Select>

              {/* TEAM */}
              <Input
                placeholder="Team (e.g. Corporate, Leisure, MICE)"
                value={form.team}
                onChange={e =>
                  setForm({
                    ...form,
                    team: e.target.value
                  })
                }
              />

              {/* ASSIGNED TO */}
              <Input
                placeholder="Assigned To (User UID / Email)"
                value={form.assignedTo}
                onChange={e =>
                  setForm({
                    ...form,
                    assignedTo: e.target.value
                  })
                }
              />

              {/* ACCOUNT MANAGER */}
              <Input
                placeholder="Account Manager UID"
                value={form.accountManagerUid}
                onChange={e =>
                  setForm({
                    ...form,
                    accountManagerUid: e.target.value
                  })
                }
              />
            </Grid>

          </Section>
          {/* ================= COMMUNICATION PREFERENCES ================= */}
          <Section title="Communication Preferences">

            {/* CHANNELS */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">
                Preferred Channels
              </p>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!form.preferredCommunication?.whatsapp}
                    onChange={e =>
                      setForm({
                        ...form,
                        preferredCommunication: {
                          ...form.preferredCommunication,
                          whatsapp: e.target.checked
                        }
                      })
                    }
                  />
                  WhatsApp
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!form.preferredCommunication?.email}
                    onChange={e =>
                      setForm({
                        ...form,
                        preferredCommunication: {
                          ...form.preferredCommunication,
                          email: e.target.checked
                        }
                      })
                    }
                  />
                  Email
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!form.preferredCommunication?.call}
                    onChange={e =>
                      setForm({
                        ...form,
                        preferredCommunication: {
                          ...form.preferredCommunication,
                          call: e.target.checked
                        }
                      })
                    }
                  />
                  Phone Call
                </label>
              </div>
            </div>

            {/* LANGUAGE */}
            <div className="max-w-xs">
              <Select
                value={form.preferredLanguage}
                onChange={e =>
                  setForm({
                    ...form,
                    preferredLanguage: e.target.value
                  })
                }
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Marathi">Marathi</option>
              </Select>
            </div>

          </Section>

          {/* ================= ADDRESS ================= */}
          <Section title="Address">

            <Grid>
              {/* ADDRESS LINE 1 */}
              <Input
                placeholder="Address Line 1 *"
                value={form.address.line1}
                onChange={e =>
                  setForm({
                    ...form,
                    address: { ...form.address, line1: e.target.value }
                  })
                }
              />

              {/* ADDRESS LINE 2 */}
              <Input
                placeholder="Address Line 2"
                value={form.address.line2}
                onChange={e =>
                  setForm({
                    ...form,
                    address: { ...form.address, line2: e.target.value }
                  })
                }
              />

              {/* COUNTRY */}
              <Select
                value={form.address.country}
                onChange={e =>
                  setForm({
                    ...form,
                    address: {
                      ...form.address,
                      country: e.target.value,
                      pincode: "",
                      city: "",
                      state: ""
                    }
                  })
                }
              >
                <option value="India">India</option>
                <option value="Other">Other</option>
              </Select>

              {/* PINCODE (INDIA ONLY) */}
              {form.address.country === "India" && (
                <Input
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

              )}
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
              {/* CITY */}
              <Input
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

              {/* STATE */}
              <Input
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
            </Grid>

            {/* GOOGLE MAP LINK */}
            {form.address.line1 && (
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(
                  [
                    form.address.line1,
                    form.address.city,
                    form.address.state,
                    form.address.country
                  ]
                    .filter(Boolean)
                    .join(", ")
                )}`}
                target="_blank"
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                📍 View on Google Maps
              </a>
            )}

          </Section>




          {/* INTERNAL */}
          <Section title="Internal Intelligence">
            <Input placeholder="Strengths (comma separated)"
              value={form.strengths.join(", ")}
              onChange={e =>
                setForm({ ...form, strengths: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })
              }
            />
            <Input placeholder="Weaknesses (comma separated)"
              value={form.weaknesses.join(", ")}
              onChange={e =>
                setForm({ ...form, weaknesses: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })
              }
            />
            <textarea
              className="border border-gray-200 rounded-md p-3 text-sm w-full"
              placeholder="Internal Notes"
              value={form.internalNotes}
              onChange={e => setForm({ ...form, internalNotes: e.target.value })}
            />
          </Section>

          {/* COMPLIANCE */}
          <Section title="Compliance">
            <Grid>
              <Input placeholder="GST Number" value={form.gstNumber}
                onChange={e => setForm({ ...form, gstNumber: e.target.value })}
              />
              <Input placeholder="PAN Number" value={form.panNumber}
                onChange={e => setForm({ ...form, panNumber: e.target.value })}
              />
              <Select value={form.kycStatus}
                onChange={e => setForm({ ...form, kycStatus: e.target.value })}
              >
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </Select>
            </Grid>
          </Section>


          {/* SAVE */}
          <div className="flex justify-end">
            <button
              onClick={save}
              className="
                bg-blue-600 text-white px-5 py-2 rounded-md
                text-sm font-medium shadow-mui transition-mui
                hover:bg-blue-700 active:scale-[0.97]
              "
            >
              Save Travel Agent
            </button>
          </div>

        </div>
      </main>
    </AdminGuard>
  );
}

/* =========================
   LAYOUT HELPERS
========================= */
function Section({ title, children }) {
  return (
    <section className="bg-white rounded-lg p-5 shadow-mui space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children, cols = 2 }) {
  return (
    <div className={`grid md:grid-cols-${cols} gap-4`}>
      {children}
    </div>
  );
}



function SpocCard({ spoc, index, isOnlyOne, onChange, onRemove, onSetPrimary }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-mui space-y-3">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-gray-900">
          SPOC {index + 1}
        </p>

        {!isOnlyOne && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        )}
      </div>

      {/* FIELDS */}
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="border border-gray-200 rounded-md px-3 py-2 text-sm"
          placeholder="Name"
          value={spoc.name}
          onChange={e => onChange("name", e.target.value)}
        />

        <input
          className="border border-gray-200 rounded-md px-3 py-2 text-sm"
          placeholder="Email"
          value={spoc.email}
          onChange={e => onChange("email", e.target.value)}
        />

        <input
          className="border border-gray-200 rounded-md px-3 py-2 text-sm"
          placeholder="Mobile"
          value={spoc.mobile}
          onChange={e => onChange("mobile", e.target.value)}
        />

        <input
          className="border border-gray-200 rounded-md px-3 py-2 text-sm"
          placeholder="Designation"
          value={spoc.designation}
          onChange={e => onChange("designation", e.target.value)}
        />

        <input
          className="border border-gray-200 rounded-md px-3 py-2 text-sm md:col-span-2"
          placeholder="Department"
          value={spoc.department}
          onChange={e => onChange("department", e.target.value)}
        />
      </div>

      {/* PRIMARY */}
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="radio"
          checked={spoc.isPrimary}
          onChange={onSetPrimary}
        />
        Primary SPOC
      </label>
    </div>
  );
}
