"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import VendorForm from "@/components/vendors/VendorForm";
import { saveVendor } from "@/lib/saveVendor";

export default function NewVendorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async formPayload => {
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const result = await saveVendor({
        vendorId: "",
        form: formPayload,
        user
      });

      if (result?.vendorId) {
        router.push(`/admin/vendors/${result.vendorId}`);
      } else {
        router.push("/admin/vendors");
      }
    } catch (err) {
      console.error("Vendor create failed:", err);
      setError(err?.message || "Failed to create vendor.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen p-4 md:p-6">
        <div className="max-w-9xl mx-auto animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl w-64" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-9xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/vendors"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Vendors
          </Link>
        </div>

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Building2 size={26} />
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <ShieldCheck size={16} />
                  Vendor Management
                </div>

                <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mt-1">
                  Create New Vendor
                </h1>

                <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                  Add a DMC, hotel, transport partner, activity supplier, visa
                  partner or any other vendor used in quotation and operations.
                </p>
              </div>
            </div>
          </div>
        </section>

        <VendorForm
          initialData={null}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/vendors")}
        />
      </div>
    </main>
  );
}