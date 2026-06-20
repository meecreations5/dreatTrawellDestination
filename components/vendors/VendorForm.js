"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs
} from "firebase/firestore";

import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  FileText,
  Globe2,
  MapPin,
  Phone,
  Save,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";

import {
  VENDOR_STATUS_OPTIONS,
  VENDOR_TYPE_OPTIONS,
  getVendorTypeLabel
} from "@/lib/vendorConstants";

/* =========================
   HELPERS
========================= */

function safeText(value = "") {
  return String(value || "").trim();
}

function toTextList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return safeText(value);
}

function parseTextList(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function getInitialForm(initialData = {}) {
  const existingCountry =
    initialData.country ||
    initialData.address?.country ||
    "";

  const isInternational =
    initialData.vendorLocationType === "international" ||
    (
      existingCountry &&
      existingCountry.toLowerCase() !== "india"
    );

  return {
    vendorName: initialData.vendorName || "",
    vendorCode: initialData.vendorCode || "",

    vendorLocationType: isInternational ? "international" : "india",

    vendorType: initialData.vendorType || "dmc",
    status: initialData.status || "active",

    contactPerson: initialData.contactPerson || "",
    designation: initialData.designation || "",

    email: initialData.email || "",
    mobile: initialData.mobile || "",
    whatsapp: initialData.whatsapp || "",
    website: initialData.website || "",

    addressLine1:
      initialData.addressLine1 ||
      initialData.address?.line1 ||
      "",
    addressLine2:
      initialData.addressLine2 ||
      initialData.address?.line2 ||
      "",

    city: initialData.city || initialData.address?.city || "",
    district: initialData.district || initialData.address?.district || "",
    state: initialData.state || initialData.address?.state || "",
    country: existingCountry || (isInternational ? "" : "India"),
    pincode: initialData.pincode || initialData.address?.pincode || "",

    postOfficeName:
      initialData.postOfficeName ||
      initialData.address?.postOfficeName ||
      "",

    destinationIds: Array.isArray(initialData.destinationIds)
      ? initialData.destinationIds
      : [],

    destinations: toTextList(
      initialData.destinations || initialData.destinationNames || []
    ),

    services: toTextList(initialData.services || []),

    gstNumber: initialData.gstNumber || "",
    panNumber: initialData.panNumber || "",

    paymentTerms: initialData.paymentTerms || "",
    cancellationPolicy: initialData.cancellationPolicy || "",

    creditDays:
      initialData.creditDays === 0 || initialData.creditDays
        ? String(initialData.creditDays)
        : "",

    bankName: initialData.bankName || initialData.bankDetails?.bankName || "",
    accountName:
      initialData.accountName || initialData.bankDetails?.accountName || "",
    accountNumber:
      initialData.accountNumber ||
      initialData.bankDetails?.accountNumber ||
      "",
    branchName:
      initialData.branchName || initialData.bankDetails?.branchName || "",

    ifscCode:
      initialData.ifscCode ||
      initialData.ifsc ||
      initialData.bankDetails?.ifscCode ||
      initialData.bankDetails?.ifsc ||
      "",

    upiId: initialData.upiId || initialData.bankDetails?.upiId || "",

    blacklistedReason: initialData.blacklistedReason || "",
    notes: initialData.notes || ""
  };
}

/* =========================
   SMALL UI
========================= */

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100  overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Icon size={19} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {title}
            </h3>

            {description && (
              <p className="text-xs text-gray-500 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
  hint,
  className = ""
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {children}

      {hint && (
        <p className="text-[11px] text-gray-400 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`
        w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
        focus:outline-none focus:ring-2 focus:ring-blue-100
        disabled:bg-gray-100 disabled:text-gray-500
        ${disabled ? "cursor-not-allowed" : ""}
      `}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="
        w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
        focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none
      "
    />
  );
}

function SelectInput({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="
        w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white
        focus:outline-none focus:ring-2 focus:ring-blue-100
      "
    >
      {children}
    </select>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function VendorForm({
  initialData = null,
  saving = false,
  error = "",
  onSubmit,
  onCancel
}) {
  const isEdit = Boolean(initialData?.id || initialData?.vendorId);

  const [form, setForm] = useState(() => getInitialForm(initialData || {}));
  const [localError, setLocalError] = useState("");

  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [postOffices, setPostOffices] = useState([]);

  const [destinationOptions, setDestinationOptions] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);

  useEffect(() => {
    setForm(getInitialForm(initialData || {}));
    setLocalError("");
    setPincodeError("");
    setPostOffices([]);
  }, [initialData]);

  useEffect(() => {
    let mounted = true;

    async function loadDestinations() {
      setDestinationLoading(true);

      try {
        const snapshot = await getDocs(collection(db, "destinations"));

        const rows = snapshot.docs
          .map(docSnap => {
            const data = docSnap.data();

            return {
              id: docSnap.id,
              name:
                data.name ||
                data.destinationName ||
                data.title ||
                data.city ||
                "Unnamed Destination",
              country: data.country || "",
              state: data.state || "",
              active: data.active !== false
            };
          })
          .filter(item => item.active)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (mounted) {
          setDestinationOptions(rows);
        }
      } catch (err) {
        console.error("Destination load failed:", err);

        if (mounted) {
          setDestinationOptions([]);
        }
      } finally {
        if (mounted) {
          setDestinationLoading(false);
        }
      }
    }

    loadDestinations();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedTypeLabel = useMemo(() => {
    return getVendorTypeLabel(form.vendorType);
  }, [form.vendorType]);

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const fetchAddressFromPincode = async pincodeValue => {
    const cleanPincode = String(pincodeValue || "").trim();

    if (form.vendorLocationType !== "india") {
      setPostOffices([]);
      setPincodeError("");
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      setPostOffices([]);
      setPincodeError("");
      return;
    }

    setPincodeLoading(true);
    setPincodeError("");

    try {
      const response = await fetch(`/api/pincode/${cleanPincode}`);
      const data = await response.json();

      if (!data.success || !Array.isArray(data.postOffices)) {
        setPostOffices([]);
        setPincodeError(data.message || "No address found.");
        return;
      }

      setPostOffices(data.postOffices);

      const firstOffice = data.postOffices[0];

      if (firstOffice) {
        setForm(prev => ({
          ...prev,
          city: firstOffice.district || prev.city,
          district: firstOffice.district || prev.district || "",
          state: firstOffice.state || prev.state,
          country: "India",
          postOfficeName: firstOffice.name || prev.postOfficeName || ""
        }));
      }
    } catch (err) {
      console.error("Address fetch failed:", err);
      setPincodeError("Failed to fetch address from pincode.");
      setPostOffices([]);
    } finally {
      setPincodeLoading(false);
    }
  };

  const toggleDestination = destination => {
    setForm(prev => {
      const currentIds = Array.isArray(prev.destinationIds)
        ? prev.destinationIds
        : [];

      const currentNames = parseTextList(prev.destinations);

      const alreadySelected =
        currentIds.includes(destination.id) ||
        currentNames.includes(destination.name);

      const nextIds = alreadySelected
        ? currentIds.filter(id => id !== destination.id)
        : [...currentIds, destination.id];

      const nextNames = alreadySelected
        ? currentNames.filter(name => name !== destination.name)
        : [...new Set([...currentNames, destination.name])];

      return {
        ...prev,
        destinationIds: nextIds,
        destinations: nextNames.join(", ")
      };
    });
  };

  const validateForm = () => {
    if (!safeText(form.vendorName)) {
      return "Vendor name is required.";
    }

    if (!safeText(form.vendorType)) {
      return "Vendor type is required.";
    }

    if (!safeText(form.contactPerson)) {
      return "Contact person is required.";
    }

    if (
      !safeText(form.mobile) &&
      !safeText(form.email) &&
      !safeText(form.whatsapp)
    ) {
      return "Please add mobile, WhatsApp, or email.";
    }

    if (form.status === "blacklisted" && !safeText(form.blacklistedReason)) {
      return "Please add blacklist reason.";
    }

    return "";
  };

  const handleSubmit = e => {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError("");

    const destinationIds = Array.isArray(form.destinationIds)
      ? form.destinationIds
      : [];

    const destinations = parseTextList(form.destinations);
    const services = parseTextList(form.services);

    const payload = {
      vendorName: safeText(form.vendorName),
      vendorCode: safeText(form.vendorCode),

      vendorLocationType: safeText(form.vendorLocationType),

      vendorType: safeText(form.vendorType),
      vendorTypeLabel: selectedTypeLabel,
      status: safeText(form.status),

      contactPerson: safeText(form.contactPerson),
      designation: safeText(form.designation),

      email: safeText(form.email).toLowerCase(),
      mobile: safeText(form.mobile),
      whatsapp: safeText(form.whatsapp),
      website: safeText(form.website),

      addressLine1: safeText(form.addressLine1),
      addressLine2: safeText(form.addressLine2),
      city: safeText(form.city),
      district: safeText(form.district),
      state: safeText(form.state),
      country: safeText(form.country),
      pincode: safeText(form.pincode),
      postOfficeName: safeText(form.postOfficeName),

      address: {
        vendorLocationType: safeText(form.vendorLocationType),
        line1: safeText(form.addressLine1),
        line2: safeText(form.addressLine2),
        city: safeText(form.city),
        district: safeText(form.district),
        state: safeText(form.state),
        country: safeText(form.country),
        pincode: safeText(form.pincode),
        postOfficeName: safeText(form.postOfficeName)
      },

      destinationIds,
      destinations,
      destinationNames: destinations,
      services,

      gstNumber: safeText(form.gstNumber).toUpperCase(),
      panNumber: safeText(form.panNumber).toUpperCase(),

      paymentTerms: safeText(form.paymentTerms),
      cancellationPolicy: safeText(form.cancellationPolicy),
      creditDays: form.creditDays ? Number(form.creditDays) : null,

      bankName: safeText(form.bankName),
      accountName: safeText(form.accountName),
      accountNumber: safeText(form.accountNumber),
      branchName: safeText(form.branchName),
      ifscCode: safeText(form.ifscCode).toUpperCase(),
      upiId: safeText(form.upiId),

      bankDetails: {
        bankName: safeText(form.bankName),
        accountName: safeText(form.accountName),
        accountNumber: safeText(form.accountNumber),
        branchName: safeText(form.branchName),
        ifscCode: safeText(form.ifscCode).toUpperCase(),
        ifsc: safeText(form.ifscCode).toUpperCase(),
        upiId: safeText(form.upiId)
      },

      blacklistedReason:
        form.status === "blacklisted"
          ? safeText(form.blacklistedReason)
          : "",

      notes: safeText(form.notes)
    };

    onSubmit?.(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* TOP BAR */}
      <div className="bg-white rounded-2xl border border-gray-100  p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Building2 size={17} />
              {isEdit ? "Edit Vendor" : "Add Vendor"}
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-1">
              {isEdit
                ? form.vendorName || "Edit Vendor"
                : "Create New Vendor"}
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Add supplier details, destination mapping, contact information,
              GST/PAN, payment terms and bank details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="
                inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                border border-gray-200 text-gray-700 text-sm font-medium
                hover:bg-gray-50 disabled:opacity-60
              "
            >
              <X size={16} />
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="
                inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 disabled:opacity-60
              "
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEdit ? "Update Vendor" : "Save Vendor"}
                </>
              )}
            </button>
          </div>
        </div>

        {(localError || error) && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}
      </div>

      {/* BASIC DETAILS */}
      <Section
        icon={Building2}
        title="Vendor Details"
        description="Primary supplier information used across quotation and operations."
      >
        <Field label="Vendor Name" required>
          <TextInput
            value={form.vendorName}
            onChange={value => updateField("vendorName", value)}
            placeholder="Example: ABC Holidays DMC"
          />
        </Field>

        <Field label="Vendor Code" hint="Auto-generated by saveVendor if blank.">
          <TextInput
            value={form.vendorCode}
            onChange={value => updateField("vendorCode", value)}
            placeholder="Example: DT-VEN-0001"
            disabled={isEdit}
          />
        </Field>

        <Field label="Vendor Type" required>
          <SelectInput
            value={form.vendorType}
            onChange={value => updateField("vendorType", value)}
          >
            {VENDOR_TYPE_OPTIONS.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Status">
          <SelectInput
            value={form.status}
            onChange={value => updateField("status", value)}
          >
            {VENDOR_STATUS_OPTIONS.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        {form.status === "blacklisted" && (
          <Field label="Blacklist Reason" required className="md:col-span-2">
            <TextArea
              value={form.blacklistedReason}
              onChange={value => updateField("blacklistedReason", value)}
              placeholder="Mention why this vendor is blacklisted."
              rows={3}
            />
          </Field>
        )}
      </Section>

      {/* CONTACT */}
      <Section
        icon={Phone}
        title="Contact Information"
        description="Main vendor SPOC and communication details."
      >
        <Field label="Contact Person" required>
          <TextInput
            value={form.contactPerson}
            onChange={value => updateField("contactPerson", value)}
            placeholder="Contact person name"
          />
        </Field>

        <Field label="Designation">
          <TextInput
            value={form.designation}
            onChange={value => updateField("designation", value)}
            placeholder="Sales Manager / Reservation Team"
          />
        </Field>

        <Field label="Mobile Number">
          <TextInput
            value={form.mobile}
            onChange={value => updateField("mobile", value)}
            placeholder="+91 98765 43210"
          />
        </Field>

        <Field label="WhatsApp Number">
          <TextInput
            value={form.whatsapp}
            onChange={value => updateField("whatsapp", value)}
            placeholder="+91 98765 43210"
          />
        </Field>

        <Field label="Email">
          <TextInput
            type="email"
            value={form.email}
            onChange={value => updateField("email", value)}
            placeholder="vendor@example.com"
          />
        </Field>

        <Field label="Website">
          <TextInput
            value={form.website}
            onChange={value => updateField("website", value)}
            placeholder="https://example.com"
          />
        </Field>
      </Section>

      {/* LOCATION */}
      <Section
        icon={MapPin}
        title="Location Details"
        description="Choose Indian or International vendor location."
      >
        <Field label="Vendor Location Type" className="md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  vendorLocationType: "india",
                  country: "India",
                  pincode: "",
                  postOfficeName: "",
                  city: "",
                  district: "",
                  state: ""
                }));

                setPostOffices([]);
                setPincodeError("");
              }}
              className={`
                rounded-2xl border px-4 py-3 text-left transition
                ${
                  form.vendorLocationType === "india"
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              <p className="text-sm font-semibold">Indian Vendor</p>
              <p className="text-xs mt-0.5">
                Enable Indian 6-digit pincode lookup
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  vendorLocationType: "international",
                  country: prev.country === "India" ? "" : prev.country,
                  pincode: "",
                  postOfficeName: ""
                }));

                setPostOffices([]);
                setPincodeError("");
              }}
              className={`
                rounded-2xl border px-4 py-3 text-left transition
                ${
                  form.vendorLocationType === "international"
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              <p className="text-sm font-semibold">International Vendor</p>
              <p className="text-xs mt-0.5">
                Postal / ZIP code is optional and free text
              </p>
            </button>
          </div>
        </Field>

        <Field label="Address Line 1" className="md:col-span-2">
          <TextInput
            value={form.addressLine1}
            onChange={value => updateField("addressLine1", value)}
            placeholder="Office / building / street"
          />
        </Field>

        <Field label="Address Line 2" className="md:col-span-2">
          <TextInput
            value={form.addressLine2}
            onChange={value => updateField("addressLine2", value)}
            placeholder="Area / landmark"
          />
        </Field>

        <Field
          label={
            form.vendorLocationType === "india"
              ? "Indian Pincode"
              : "Postal / ZIP Code"
          }
          hint={
            form.vendorLocationType === "india"
              ? "Enter 6-digit Indian pincode to auto-fill city/state/country."
              : "Optional. Supports international postal/ZIP code format."
          }
        >
          <div className="relative">
            <TextInput
              value={form.pincode}
              onChange={value => {
                const isIndia = form.vendorLocationType === "india";

                const cleanValue = isIndia
                  ? value.replace(/\D/g, "").slice(0, 6)
                  : value.slice(0, 20);

                updateField("pincode", cleanValue);

                if (!isIndia) {
                  setPostOffices([]);
                  setPincodeError("");
                  return;
                }

                if (cleanValue.length === 6) {
                  fetchAddressFromPincode(cleanValue);
                } else {
                  setPostOffices([]);
                  setPincodeError("");
                }
              }}
              placeholder={
                form.vendorLocationType === "india"
                  ? "Enter 6-digit pincode"
                  : "Enter postal / ZIP code"
              }
            />

            {pincodeLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600">
                Fetching...
              </span>
            )}
          </div>

          {pincodeError && form.vendorLocationType === "india" && (
            <p className="text-[11px] text-red-500 mt-1">
              {pincodeError}
            </p>
          )}
        </Field>

        {postOffices.length > 0 && form.vendorLocationType === "india" && (
          <Field label="Post Office / Locality">
            <select
              value={form.postOfficeName || ""}
              onChange={e => {
                const selectedName = e.target.value;

                const selectedOffice = postOffices.find(
                  item => item.name === selectedName
                );

                setForm(prev => ({
                  ...prev,
                  postOfficeName: selectedOffice?.name || "",
                  city: selectedOffice?.district || prev.city,
                  district: selectedOffice?.district || prev.district || "",
                  state: selectedOffice?.state || prev.state,
                  country: "India"
                }));
              }}
              className="
                w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            >
              {postOffices.map(item => (
                <option
                  key={`${item.name}-${item.branchType}-${item.deliveryStatus}`}
                  value={item.name}
                >
                  {item.name} — {item.district}, {item.state}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label={
            form.vendorLocationType === "india"
              ? "City / District"
              : "City"
          }
        >
          <TextInput
            value={form.city}
            onChange={value => {
              updateField("city", value);
              updateField("district", value);
            }}
            placeholder={
              form.vendorLocationType === "india"
                ? "City / District"
                : "City"
            }
          />
        </Field>

        <Field
          label={
            form.vendorLocationType === "india"
              ? "State"
              : "State / Province"
          }
        >
          <TextInput
            value={form.state}
            onChange={value => updateField("state", value)}
            placeholder={
              form.vendorLocationType === "india"
                ? "State"
                : "State / Province"
            }
          />
        </Field>

        <Field label="Country">
          <TextInput
            value={form.country}
            onChange={value => {
              updateField("country", value);

              if (form.vendorLocationType === "international") {
                setPostOffices([]);
                setPincodeError("");
              }
            }}
            placeholder={
              form.vendorLocationType === "india"
                ? "India"
                : "Country"
            }
            disabled={form.vendorLocationType === "india"}
          />
        </Field>
      </Section>

      {/* DESTINATION & SERVICES */}
      <Section
        icon={Globe2}
        title="Destination & Services"
        description="Select destinations from Firebase destination master."
      >
        <Field
          label="Destinations"
          className="md:col-span-2"
          hint="Select one or more destinations. These are loaded from Firebase destinations collection."
        >
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            {destinationLoading ? (
              <div className="text-sm text-gray-500">
                Loading destinations...
              </div>
            ) : destinationOptions.length === 0 ? (
              <div className="text-sm text-gray-500">
                No destinations found in destination master.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {destinationOptions.map(destination => {
                  const selectedNames = parseTextList(form.destinations);

                  const selected = Array.isArray(form.destinationIds)
                    ? form.destinationIds.includes(destination.id) ||
                      selectedNames.includes(destination.name)
                    : selectedNames.includes(destination.name);

                  return (
                    <button
                      key={destination.id}
                      type="button"
                      onClick={() => toggleDestination(destination)}
                      className={`
                        text-left rounded-xl border px-3 py-2 transition
                        ${
                          selected
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }
                      `}
                    >
                      <div className="text-sm font-semibold">
                        {destination.name}
                      </div>

                      {(destination.country || destination.state) && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[destination.state, destination.country]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {safeText(form.destinations) && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-xs font-medium text-gray-500">
                  Selected Destinations
                </p>

                <p className="text-sm text-gray-800 mt-0.5">
                  {form.destinations}
                </p>
              </div>
            )}
          </div>
        </Field>

        <Field
          label="Services"
          className="md:col-span-2"
          hint="Add multiple services separated by comma."
        >
          <TextInput
            value={form.services}
            onChange={value => updateField("services", value)}
            placeholder="Hotel, Transfers, Sightseeing, Visa, Activities"
          />
        </Field>
      </Section>

      {/* TAX & PAYMENT */}
      <Section
        icon={FileText}
        title="Tax & Payment Terms"
        description="Commercial details for billing, confirmations and vendor payments."
      >
        <Field label="GST Number">
          <TextInput
            value={form.gstNumber}
            onChange={value => updateField("gstNumber", value)}
            placeholder="GST Number"
          />
        </Field>

        <Field label="PAN Number">
          <TextInput
            value={form.panNumber}
            onChange={value => updateField("panNumber", value)}
            placeholder="PAN Number"
          />
        </Field>

        <Field label="Payment Terms">
          <TextInput
            value={form.paymentTerms}
            onChange={value => updateField("paymentTerms", value)}
            placeholder="Advance / Before check-in / Credit"
          />
        </Field>

        <Field label="Credit Days">
          <TextInput
            type="number"
            value={form.creditDays}
            onChange={value => updateField("creditDays", value)}
            placeholder="Example: 7"
          />
        </Field>

        <Field label="Cancellation Policy" className="md:col-span-2">
          <TextArea
            value={form.cancellationPolicy}
            onChange={value => updateField("cancellationPolicy", value)}
            placeholder="Vendor cancellation terms..."
            rows={3}
          />
        </Field>
      </Section>

      {/* BANK */}
      <Section
        icon={Banknote}
        title="Bank Details"
        description="Optional bank information for vendor payment processing."
      >
        <Field label="Bank Name">
          <TextInput
            value={form.bankName}
            onChange={value => updateField("bankName", value)}
            placeholder="Bank name"
          />
        </Field>

        <Field label="Account Holder Name">
          <TextInput
            value={form.accountName}
            onChange={value => updateField("accountName", value)}
            placeholder="Account holder name"
          />
        </Field>

        <Field label="Account Number">
          <TextInput
            value={form.accountNumber}
            onChange={value => updateField("accountNumber", value)}
            placeholder="Account number"
          />
        </Field>

        <Field label="Branch Name">
          <TextInput
            value={form.branchName}
            onChange={value => updateField("branchName", value)}
            placeholder="Branch name"
          />
        </Field>

        <Field label="IFSC Code">
          <TextInput
            value={form.ifscCode}
            onChange={value => updateField("ifscCode", value)}
            placeholder="IFSC code"
          />
        </Field>

        <Field label="UPI ID">
          <TextInput
            value={form.upiId}
            onChange={value => updateField("upiId", value)}
            placeholder="vendor@upi"
          />
        </Field>
      </Section>

      {/* NOTES */}
      <Section
        icon={CheckCircle2}
        title="Internal Notes"
        description="Private notes for admin/team reference."
      >
        <Field label="Notes" className="md:col-span-2">
          <TextArea
            value={form.notes}
            onChange={value => updateField("notes", value)}
            placeholder="Preferred vendor, special terms, escalation notes, quality remarks..."
            rows={4}
          />
        </Field>
      </Section>

      {/* FOOTER ACTIONS */}
      <div className="sticky bottom-4 z-10 bg-white rounded-2xl border border-gray-100 shadow-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {isEdit ? "Update vendor details?" : "Save this vendor?"}
          </p>
          <p className="text-xs text-gray-500">
            Vendor will be available in quotation, lead and payment workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="
              px-4 py-2.5 rounded-xl border border-gray-200
              text-sm font-medium text-gray-700 hover:bg-gray-50
              disabled:opacity-60
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="
              px-5 py-2.5 rounded-xl bg-blue-600 text-white
              text-sm font-medium hover:bg-blue-700 disabled:opacity-60
              inline-flex items-center gap-2
            "
          >
            {saving ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Vendor
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}