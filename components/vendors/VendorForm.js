// components/vendors/VendorForm.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
  X
} from "lucide-react";

import {
  VENDOR_STATUS,
  VENDOR_STATUS_OPTIONS,
  VENDOR_TYPE_OPTIONS
} from "@/lib/vendorConstants";

/* =========================
   DEFAULT FORM
========================= */

const DEFAULT_FORM = {
  vendorName: "",
  vendorType: "dmc",
  status: VENDOR_STATUS.ACTIVE,

  destinationsText: "",

  contactPerson: "",
  email: "",
  mobile: "",
  whatsapp: "",

  city: "",
  state: "",
  country: "India",
  addressLine1: "",
  addressLine2: "",
  pincode: "",

  gstNumber: "",
  panNumber: "",

  paymentTerms: "",
  cancellationPolicy: "",
  notes: "",

  accountName: "",
  accountNumber: "",
  bankName: "",
  branchName: "",
  ifsc: "",
  upiId: ""
};

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function toDestinationsText(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  return cleanString(value);
}

function buildInitialForm(initialData = {}) {
  return {
    ...DEFAULT_FORM,

    vendorName: cleanString(initialData.vendorName),
    vendorType: cleanString(initialData.vendorType) || DEFAULT_FORM.vendorType,
    status: cleanString(initialData.status) || DEFAULT_FORM.status,

    destinationsText: toDestinationsText(
      initialData.destinations || initialData.destinationNames
    ),

    contactPerson: cleanString(initialData.contactPerson),
    email: cleanString(initialData.email),
    mobile: cleanString(initialData.mobile),
    whatsapp: cleanString(initialData.whatsapp),

    city: cleanString(initialData.city || initialData?.address?.city),
    state: cleanString(initialData.state || initialData?.address?.state),
    country: cleanString(
      initialData.country || initialData?.address?.country || "India"
    ),

    addressLine1: cleanString(initialData?.address?.line1),
    addressLine2: cleanString(initialData?.address?.line2),
    pincode: cleanString(initialData?.address?.pincode),

    gstNumber: cleanString(initialData.gstNumber),
    panNumber: cleanString(initialData.panNumber),

    paymentTerms: cleanString(initialData.paymentTerms),
    cancellationPolicy: cleanString(initialData.cancellationPolicy),
    notes: cleanString(initialData.notes),

    accountName: cleanString(initialData?.bankDetails?.accountName),
    accountNumber: cleanString(initialData?.bankDetails?.accountNumber),
    bankName: cleanString(initialData?.bankDetails?.bankName),
    branchName: cleanString(initialData?.bankDetails?.branchName),
    ifsc: cleanString(initialData?.bankDetails?.ifsc),
    upiId: cleanString(initialData?.bankDetails?.upiId)
  };
}

function parseDestinations(value = "") {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function FieldLabel({ children, required = false }) {
  return (
    <label className="text-xs font-medium text-gray-500">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  required = false,
  type = "text",
  disabled = false
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>

      <input
        type={type}
        name={name}
        value={value}
        disabled={disabled}
        onChange={onChange}
        placeholder={placeholder}
        className="
          mt-1 w-full rounded-xl border border-gray-200 bg-white
          px-3 py-2 text-sm text-gray-800
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-100
          disabled:bg-gray-50 disabled:text-gray-400
        "
      />
    </div>
  );
}

function Textarea({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  rows = 3,
  disabled = false
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>

      <textarea
        name={name}
        value={value}
        disabled={disabled}
        rows={rows}
        onChange={onChange}
        placeholder={placeholder}
        className="
          mt-1 w-full rounded-xl border border-gray-200 bg-white
          px-3 py-2 text-sm text-gray-800 resize-none
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-100
          disabled:bg-gray-50 disabled:text-gray-400
        "
      />
    </div>
  );
}

/* =========================
   COMPONENT
========================= */

export default function VendorForm({
  initialData = null,
  saving = false,
  error = "",
  onSubmit,
  onCancel
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [localError, setLocalError] = useState("");

  const isEditing = Boolean(initialData?.id || initialData?.vendorId);

  useEffect(() => {
    setForm(buildInitialForm(initialData || {}));
    setLocalError("");
  }, [initialData]);

  const destinationPreview = useMemo(
    () => parseDestinations(form.destinationsText),
    [form.destinationsText]
  );

  const handleChange = e => {
    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: value
    }));

    setLocalError("");
  };

  const validate = () => {
    if (!form.vendorName.trim()) {
      return "Vendor name is required.";
    }

    if (!form.vendorType) {
      return "Vendor type is required.";
    }

    if (!form.contactPerson.trim()) {
      return "Contact person is required.";
    }

    if (
      !form.mobile.trim() &&
      !form.email.trim() &&
      !form.whatsapp.trim()
    ) {
      return "Add at least one contact detail: mobile, WhatsApp, or email.";
    }

    return "";
  };

  const handleSubmit = e => {
    e.preventDefault();

    const validationError = validate();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const payload = {
      ...form,
      destinations: parseDestinations(form.destinationsText),

      address: {
        line1: form.addressLine1,
        line2: form.addressLine2,
        city: form.city,
        state: form.state,
        country: form.country,
        pincode: form.pincode
      },

      bankDetails: {
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        bankName: form.bankName,
        branchName: form.branchName,
        ifsc: form.ifsc,
        upiId: form.upiId
      }
    };

    onSubmit?.(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      {/* HEADER */}
      <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Vendor" : "Add New Vendor"}
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Maintain vendor details, contact person, destination coverage and
            payment information.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="
              h-9 w-9 rounded-xl border border-gray-200
              flex items-center justify-center text-gray-500
              hover:bg-gray-50 hover:text-gray-800
              disabled:opacity-60
            "
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* BASIC DETAILS */}
        <section className="space-y-4">
          <SectionTitle
            icon={Building2}
            title="Vendor Details"
            description="Basic vendor profile and operational status."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Vendor Name"
              name="vendorName"
              value={form.vendorName}
              onChange={handleChange}
              placeholder="Example: ABC Maldives DMC"
              required
              disabled={saving}
            />

            <div>
              <FieldLabel required>Vendor Type</FieldLabel>

              <select
                name="vendorType"
                value={form.vendorType}
                disabled={saving}
                onChange={handleChange}
                className="
                  mt-1 w-full rounded-xl border border-gray-200 bg-white
                  px-3 py-2 text-sm text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                  disabled:bg-gray-50 disabled:text-gray-400
                "
              >
                {VENDOR_TYPE_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>

              <select
                name="status"
                value={form.status}
                disabled={saving}
                onChange={handleChange}
                className="
                  mt-1 w-full rounded-xl border border-gray-200 bg-white
                  px-3 py-2 text-sm text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                  disabled:bg-gray-50 disabled:text-gray-400
                "
              >
                {VENDOR_STATUS_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Destinations</FieldLabel>

              <input
                name="destinationsText"
                value={form.destinationsText}
                disabled={saving}
                onChange={handleChange}
                placeholder="Maldives, Bali, Thailand"
                className="
                  mt-1 w-full rounded-xl border border-gray-200 bg-white
                  px-3 py-2 text-sm text-gray-800
                  placeholder:text-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                  disabled:bg-gray-50 disabled:text-gray-400
                "
              />

              {destinationPreview.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {destinationPreview.map(item => (
                    <span
                      key={item}
                      className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className="space-y-4">
          <SectionTitle
            icon={User}
            title="Contact Information"
            description="At least one contact detail is required."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              name="contactPerson"
              value={form.contactPerson}
              onChange={handleChange}
              placeholder="Vendor SPOC name"
              required
              disabled={saving}
            />

            <Input
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="vendor@example.com"
              type="email"
              disabled={saving}
            />

            <Input
              label="Mobile"
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              disabled={saving}
            />

            <Input
              label="WhatsApp"
              name="whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              disabled={saving}
            />
          </div>
        </section>

        {/* ADDRESS */}
        <section className="space-y-4">
          <SectionTitle
            icon={MapPin}
            title="Address"
            description="Vendor office or billing address."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              name="addressLine1"
              value={form.addressLine1}
              onChange={handleChange}
              placeholder="Office / building / street"
              disabled={saving}
            />

            <Input
              label="Address Line 2"
              name="addressLine2"
              value={form.addressLine2}
              onChange={handleChange}
              placeholder="Area / landmark"
              disabled={saving}
            />

            <Input
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="City"
              disabled={saving}
            />

            <Input
              label="State"
              name="state"
              value={form.state}
              onChange={handleChange}
              placeholder="State"
              disabled={saving}
            />

            <Input
              label="Country"
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="Country"
              disabled={saving}
            />

            <Input
              label="Pincode"
              name="pincode"
              value={form.pincode}
              onChange={handleChange}
              placeholder="Pincode"
              disabled={saving}
            />
          </div>
        </section>

        {/* TAX */}
        <section className="space-y-4">
          <SectionTitle
            icon={FileText}
            title="Tax & Terms"
            description="GST, PAN and commercial terms."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="GST Number"
              name="gstNumber"
              value={form.gstNumber}
              onChange={handleChange}
              placeholder="GSTIN"
              disabled={saving}
            />

            <Input
              label="PAN Number"
              name="panNumber"
              value={form.panNumber}
              onChange={handleChange}
              placeholder="PAN"
              disabled={saving}
            />
          </div>

          <Textarea
            label="Payment Terms"
            name="paymentTerms"
            value={form.paymentTerms}
            onChange={handleChange}
            placeholder="Example: 50% advance, balance before check-in."
            disabled={saving}
          />

          <Textarea
            label="Cancellation Policy"
            name="cancellationPolicy"
            value={form.cancellationPolicy}
            onChange={handleChange}
            placeholder="Vendor cancellation terms."
            disabled={saving}
          />
        </section>

        {/* BANK DETAILS */}
        <section className="space-y-4">
          <SectionTitle
            icon={CreditCard}
            title="Bank Details"
            description="Used later for vendor payment tracking."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Account Name"
              name="accountName"
              value={form.accountName}
              onChange={handleChange}
              placeholder="Beneficiary name"
              disabled={saving}
            />

            <Input
              label="Account Number"
              name="accountNumber"
              value={form.accountNumber}
              onChange={handleChange}
              placeholder="Bank account number"
              disabled={saving}
            />

            <Input
              label="Bank Name"
              name="bankName"
              value={form.bankName}
              onChange={handleChange}
              placeholder="Bank name"
              disabled={saving}
            />

            <Input
              label="Branch Name"
              name="branchName"
              value={form.branchName}
              onChange={handleChange}
              placeholder="Branch"
              disabled={saving}
            />

            <Input
              label="IFSC"
              name="ifsc"
              value={form.ifsc}
              onChange={handleChange}
              placeholder="IFSC code"
              disabled={saving}
            />

            <Input
              label="UPI ID"
              name="upiId"
              value={form.upiId}
              onChange={handleChange}
              placeholder="upi@bank"
              disabled={saving}
            />
          </div>
        </section>

        {/* NOTES */}
        <section className="space-y-4">
          <SectionTitle
            icon={Mail}
            title="Internal Notes"
            description="Private notes visible only to your team."
          />

          <Textarea
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Special instructions, preferred communication time, reliability notes, etc."
            rows={4}
            disabled={saving}
          />
        </section>

        {(localError || error) && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {localError || error}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="
              px-4 py-2 rounded-xl border border-gray-200
              text-sm text-gray-700 hover:bg-gray-50
              disabled:opacity-60
            "
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={saving}
          className="
            px-5 py-2 rounded-xl bg-blue-600 text-white
            text-sm font-medium hover:bg-blue-700
            disabled:opacity-60
            inline-flex items-center justify-center gap-2
          "
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}

          {saving
            ? "Saving..."
            : isEditing
              ? "Update Vendor"
              : "Save Vendor"}
        </button>
      </div>
    </form>
  );
}