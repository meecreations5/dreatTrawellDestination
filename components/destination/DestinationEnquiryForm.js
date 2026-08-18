"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import {
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
  Users,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  travelDate: "",
  adults: "2",
  children: "0",
  city: "",
  message: ""
};

function cleanPhone(value = "") {
  return value.replace(/[^\d+]/g, "").slice(0, 15);
}

export default function DestinationEnquiryForm({
  open,
  onClose,
  destination
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return;

    const handleEscape = e => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleClose = () => {
    if (submitting) return;

    setErrors({});
    setSubmitError("");
    setSubmitted(false);
    onClose?.();
  };

  const update = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));

    setErrors(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    setSubmitError("");
  };

  const validate = () => {
    const e = {};

    if (!form.name.trim()) {
      e.name = "Name is required";
    }

    if (!form.phone.trim()) {
      e.phone = "Phone number is required";
    } else if (cleanPhone(form.phone).length < 8) {
      e.phone = "Enter a valid phone number";
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      e.email = "Enter a valid email";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async e => {
    e.preventDefault();

    if (submitting) return;
    if (!validate()) return;

    try {
      setSubmitting(true);
      setSubmitError("");

      await addDoc(collection(db, "destination_enquiries"), {
        destinationId: destination?.id || "",
        destinationName: destination?.name || "",
        destinationCode: destination?.code || "",
        destinationType: destination?.destinationType || "",

        customerName: form.name.trim(),
        customerPhone: cleanPhone(form.phone),
        customerEmail: form.email.trim().toLowerCase(),
        departureCity: form.city.trim(),

        travelDate: form.travelDate || "",
        adults: Number(form.adults || 0),
        children: Number(form.children || 0),
        totalPax: Number(form.adults || 0) + Number(form.children || 0),

        message: form.message.trim(),

        status: "new",
        source: "public_destination_page",
        assignedTo: "",
        leadId: "",
        convertedToLead: false,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSubmitted(true);
      setForm(INITIAL_FORM);
    } catch (error) {
      console.error("Destination enquiry failed:", error);
      setSubmitError("Unable to submit enquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* OVERLAY */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        aria-label="Close enquiry form"
      />

      {/* MODAL */}
      <div className="absolute inset-x-4 top-1/2 mx-auto max-h-[92vh] max-w-2xl -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                <Send size={13} />
                Destination Enquiry
              </div>

              <h2 className="text-xl font-semibold text-slate-950">
                {submitted
                  ? "Enquiry Submitted"
                  : `Plan ${destination?.name || "Your Trip"}`}
              </h2>

              {!submitted && (
                <p className="mt-1 text-sm text-slate-500">
                  Share your travel details and our team will connect with you.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-5">
          {submitted ? (
            <SuccessState
              destination={destination}
              onAnother={() => setSubmitted(false)}
              onClose={handleClose}
            />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  icon={User}
                  label="Full Name"
                  required
                  value={form.name}
                  error={errors.name}
                  placeholder="Enter your name"
                  onChange={value => update("name", value)}
                />

                <FormInput
                  icon={Phone}
                  label="Phone / WhatsApp"
                  required
                  value={form.phone}
                  error={errors.phone}
                  placeholder="Enter phone number"
                  onChange={value => update("phone", cleanPhone(value))}
                />
              </div>

              <FormInput
                icon={Mail}
                label="Email"
                type="email"
                value={form.email}
                error={errors.email}
                placeholder="Enter email address"
                onChange={value => update("email", value)}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  icon={CalendarDays}
                  label="Travel Date"
                  type="date"
                  value={form.travelDate}
                  onChange={value => update("travelDate", value)}
                />

                <FormInput
                  icon={MapPin}
                  label="Departure City"
                  value={form.city}
                  placeholder="Example: Delhi"
                  onChange={value => update("city", value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  icon={Users}
                  label="Adults"
                  type="number"
                  min="1"
                  value={form.adults}
                  onChange={value => update("adults", value)}
                />

                <FormInput
                  icon={Users}
                  label="Children"
                  type="number"
                  min="0"
                  value={form.children}
                  onChange={value => update("children", value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <MessageSquare size={14} />
                  Message
                </label>

                <textarea
                  value={form.message}
                  onChange={e => update("message", e.target.value)}
                  placeholder="Tell us your travel preference, budget, hotel category, or special request."
                  className="min-h-[110px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {submitError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                  {submitError}
                </div>
              )}

              <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-slate-100 bg-white p-5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Send size={16} />
                  {submitting ? "Submitting..." : "Submit Enquiry"}
                </button>

                <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
                  By submitting this form, you agree to be contacted by Dream
                  Trawell regarding this destination enquiry.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessState({ destination, onAnother, onClose }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={30} />
      </div>

      <h3 className="text-xl font-semibold text-slate-950">
        Thank you!
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Your enquiry for{" "}
        <span className="font-semibold text-slate-900">
          {destination?.name || "this destination"}
        </span>{" "}
        has been submitted. Our travel expert will connect with you shortly.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Close
        </button>

        <button
          type="button"
          onClick={onAnother}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
        >
          Submit Another
        </button>
      </div>
    </div>
  );
}

function FormInput({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  type = "text",
  min
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        {Icon && <Icon size={14} />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        min={min}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-4 ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-blue-300 focus:ring-blue-100"
        }`}
      />

      {error && (
        <p className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}