"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";

import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText,
  sanitizeSignatureHtml
} from "@/lib/signatureUtils";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

export default function MyProfilePage() {
  const { user, loading: authLoading } = useAuth();

  const uid = user?.uid || user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    designation: "",
    department: "",
    signatureHtml: "",
    whatsappSignature: "",
    signatureEnabled: true
  });

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!uid || !user) return;

      setLoading(true);

      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);

        const data = snap.exists() ? snap.data() : {};

        if (!mounted) return;

        setForm({
          name: getFirstValue(
            data.name,
            data.displayName,
            user.displayName,
            user.name,
            user.email
          ),
          email: getFirstValue(data.email, user.email),
          mobile: getFirstValue(data.mobile, data.phone, user.mobile),
          designation: getFirstValue(
            data.designation,
            data.roleTitle,
            data.role
          ),
          department: getFirstValue(data.department, data.teamName),
          signatureHtml: getFirstValue(
            data.signatureHtml,
            data.emailSignatureHtml
          ),
          whatsappSignature: getFirstValue(
            data.whatsappSignature,
            data.signatureText
          ),
          signatureEnabled: data.signatureEnabled !== false
        });
      } catch (error) {
        console.error("Failed to load profile:", error);
        alert("Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [uid, user]);

  const previewUser = useMemo(() => {
    return {
      uid,
      name: form.name,
      displayName: form.name,
      email: form.email,
      mobile: form.mobile,
      designation: form.designation,
      department: form.department,
      signatureHtml: form.signatureHtml,
      emailSignatureHtml: form.signatureHtml,
      whatsappSignature: form.whatsappSignature,
      signatureText: form.whatsappSignature
    };
  }, [uid, form]);

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveProfile = async () => {
    if (!uid) {
      alert("User not found");
      return;
    }

    if (!form.name.trim()) {
      alert("Name is required");
      return;
    }

    if (!form.email.trim()) {
      alert("Email is required");
      return;
    }

    setSaving(true);

    try {
      await setDoc(
        doc(db, "users", uid),
        {
          uid,
          name: form.name.trim(),
          displayName: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          designation: form.designation.trim(),
          department: form.department.trim(),

          signatureEnabled: Boolean(form.signatureEnabled),
          signatureHtml: sanitizeSignatureHtml(form.signatureHtml),
          emailSignatureHtml: sanitizeSignatureHtml(form.signatureHtml),
          whatsappSignature: form.whatsappSignature.trim(),
          signatureText: form.whatsappSignature.trim(),

          profileUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      alert("Profile updated successfully");
    } catch (error) {
      console.error("Profile update failed:", error);
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <Card>
          <p className="text-sm text-gray-500">Loading profile...</p>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <Card>
          <p className="text-sm text-gray-500">
            Please login to view profile.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          My Profile
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your profile details, email signature and WhatsApp signature.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT FORM */}
        <Card className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Basic Details
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              These details will be used in quotation communication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">
                Full Name
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.name}
                onChange={e => updateField("name", e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Designation
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.designation}
                onChange={e =>
                  updateField("designation", e.target.value)
                }
                placeholder="Sales Executive"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Email
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.email}
                onChange={e => updateField("email", e.target.value)}
                placeholder="name@dreamtrawell.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Mobile
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.mobile}
                onChange={e => updateField("mobile", e.target.value)}
                placeholder="9876543210"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Department / Team
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.department}
                onChange={e =>
                  updateField("department", e.target.value)
                }
                placeholder="Sales"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Role
              </label>
              <input
                className={`${inputClass} mt-1 bg-gray-50 text-gray-500`}
                value={user.role || "—"}
                disabled
              />
            </div>
          </div>

          <div className="border-t pt-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Signature Details
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                This signature will be included in quotation email and WhatsApp.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.signatureEnabled}
                onChange={e =>
                  updateField("signatureEnabled", e.target.checked)
                }
              />
              Signature active
            </label>

            <div>
              <label className="text-xs text-gray-500">
                Email Signature HTML
              </label>
              <textarea
                rows={8}
                className={`${inputClass} mt-1 font-mono`}
                value={form.signatureHtml}
                onChange={e =>
                  updateField("signatureHtml", e.target.value)
                }
                placeholder="<p>Regards,<br/><b>Your Name</b><br/>DreamTrawell</p>"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Use simple HTML only. Example: p, br, b, strong, div, span.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                WhatsApp Signature
              </label>
              <textarea
                rows={5}
                className={`${inputClass} mt-1`}
                value={form.whatsappSignature}
                onChange={e =>
                  updateField("whatsappSignature", e.target.value)
                }
                placeholder={`Regards,\nYour Name\nDreamTrawell\nMobile: 9876543210`}
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-5">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </Card>

        {/* RIGHT PREVIEW */}
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Profile Summary
            </h2>

            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="font-medium text-gray-900">
                  {form.name || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Designation</p>
                <p className="font-medium text-gray-900">
                  {form.designation || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900 break-all">
                  {form.email || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Mobile</p>
                <p className="font-medium text-gray-900">
                  {form.mobile || "—"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Email Signature Preview
            </h2>

            <div
              className="border border-gray-200 rounded-lg p-3 text-sm bg-white overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: buildEmailSignatureHtml(previewUser)
              }}
            />
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              WhatsApp Signature Preview
            </h2>

            <pre className="border border-gray-200 rounded-lg p-3 text-xs bg-gray-50 whitespace-pre-wrap">
              {buildWhatsAppSignatureText(previewUser)}
            </pre>
          </Card>
        </div>
      </div>
    </main>
  );
}