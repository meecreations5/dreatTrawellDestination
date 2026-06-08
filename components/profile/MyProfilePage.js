// components/profile/MyProfilePage.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";

import { getBrandingSettings } from "@/lib/brandingSettings";

import {
  buildEmailSignatureHtml,
  buildPersonalSignatureContentHtml,
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

function ProfileSkeleton() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="bg-gray-100 rounded-2xl h-36" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index}>
                <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
                <div className="h-10 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>

          <div className="h-40 bg-gray-100 rounded-lg" />
          <div className="h-28 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg w-36 ml-auto" />
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="h-4 bg-gray-200 rounded w-36 mb-4" />
            <div className="h-32 bg-gray-100 rounded-lg" />
          </Card>

          <Card>
            <div className="h-4 bg-gray-200 rounded w-36 mb-4" />
            <div className="h-40 bg-gray-100 rounded-lg" />
          </Card>
        </div>
      </div>
    </main>
  );
}

function SignatureToolbar({ onChange }) {
  const exec = command => {
    document.execCommand(command, false, null);
    onChange();
  };

  const addLink = () => {
    const url = prompt("Enter link URL");
    if (!url?.trim()) return;

    document.execCommand("createLink", false, url.trim());
    onChange();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-t-lg bg-gray-50 px-3 py-2">
      <button
        type="button"
        onClick={() => exec("bold")}
        className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
      >
        Bold
      </button>

      <button
        type="button"
        onClick={() => exec("italic")}
        className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
      >
        Italic
      </button>

      <button
        type="button"
        onClick={() => exec("underline")}
        className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
      >
        Underline
      </button>

      <button
        type="button"
        onClick={() => exec("insertUnorderedList")}
        className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
      >
        Bullets
      </button>

      <button
        type="button"
        onClick={addLink}
        className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
      >
        Link
      </button>
    </div>
  );
}

export default function MyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const signatureEditorRef = useRef(null);

  const uid = user?.uid || user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [branding, setBranding] = useState(null);

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
        const brandingData = await getBrandingSettings();

        if (!mounted) return;

        const loadedForm = {
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
        };

        setBranding(brandingData);
        setForm(loadedForm);

        setTimeout(() => {
          if (signatureEditorRef.current) {
            signatureEditorRef.current.innerHTML =
              loadedForm.signatureHtml || "";
          }
        }, 0);
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

      ...(branding || {}),

      signatureHtml: form.signatureHtml,
      emailSignatureHtml: form.signatureHtml,
      whatsappSignature: form.whatsappSignature,
      signatureText: form.whatsappSignature
    };
  }, [uid, form, branding]);

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const syncSignatureEditor = () => {
    updateField(
      "signatureHtml",
      signatureEditorRef.current?.innerHTML || ""
    );
  };

  const generateEmailSignature = () => {
    const html = buildPersonalSignatureContentHtml(previewUser);

    updateField("signatureHtml", html);

    if (signatureEditorRef.current) {
      signatureEditorRef.current.innerHTML = html;
    }
  };

  const generateWhatsAppSignature = () => {
    updateField(
      "whatsappSignature",
      buildWhatsAppSignatureText({
        ...previewUser,
        whatsappSignature: ""
      })
    );
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

    const cleanSignatureHtml = sanitizeSignatureHtml(
      signatureEditorRef.current?.innerHTML || form.signatureHtml
    );

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
          signatureHtml: cleanSignatureHtml,
          emailSignatureHtml: cleanSignatureHtml,
          whatsappSignature: form.whatsappSignature.trim(),
          signatureText: form.whatsappSignature.trim(),

          profileUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setForm(prev => ({
        ...prev,
        signatureHtml: cleanSignatureHtml
      }));

      alert("Profile updated successfully");
    } catch (error) {
      console.error("Profile update failed:", error);
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <ProfileSkeleton />;
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
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-6 text-white">
        <p className="text-xs uppercase tracking-wide opacity-80">
          DreamTrawell Team Profile
        </p>

        <h1 className="text-2xl font-semibold mt-1">
          My Profile & Signature
        </h1>

        <p className="text-sm opacity-90 mt-2 max-w-2xl">
          Manage your travel consultant details and personal signature. Company
          logo, website and social links are controlled by admin branding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Travel Consultant Details
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                These details appear in quotation communication.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Full Name</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.name}
                  onChange={e => updateField("name", e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Designation</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.designation}
                  onChange={e =>
                    updateField("designation", e.target.value)
                  }
                  placeholder="Travel Consultant"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.email}
                  onChange={e => updateField("email", e.target.value)}
                  placeholder="name@dreamtrawell.com"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Mobile</label>
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
                  onChange={e => updateField("department", e.target.value)}
                  placeholder="Sales / Operations"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Role</label>
                <input
                  className={`${inputClass} mt-1 bg-gray-50 text-gray-500`}
                  value={user.role || "—"}
                  disabled
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Email Signature Content
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Edit your personal signature text. Admin branding will add
                  logo, website and social accounts automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={generateEmailSignature}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                Generate Signature
              </button>
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
              <SignatureToolbar onChange={syncSignatureEditor} />

              <div
                ref={signatureEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncSignatureEditor}
                className="min-h-[160px] border border-t-0 border-gray-200 rounded-b-lg p-4 text-sm outline-none overflow-x-auto focus:ring-2 focus:ring-blue-100"
              />

              <p className="text-[11px] text-gray-500 mt-1">
                This is your personal signature body. Company branding is
                applied from admin branding settings.
              </p>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  WhatsApp Signature
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Plain-text signature used in WhatsApp quotation drafts.
                </p>
              </div>

              <button
                type="button"
                onClick={generateWhatsAppSignature}
                className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 rounded-lg hover:bg-green-100"
              >
                Generate WhatsApp Signature
              </button>
            </div>

            <textarea
              rows={5}
              className={inputClass}
              value={form.whatsappSignature}
              onChange={e =>
                updateField("whatsappSignature", e.target.value)
              }
              placeholder={`Regards,\nYour Name\nDreamTrawell\nMobile: 9876543210`}
            />
          </section>

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

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Branding Source
            </h2>

            {previewUser.companyLogoUrl ? (
              <img
                src={previewUser.companyLogoUrl}
                alt={previewUser.companyName}
                className="w-20 h-20 rounded-xl object-contain border border-gray-200 bg-white"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-semibold">
                Logo
              </div>
            )}

            <div>
              <p className="font-semibold text-gray-900">
                {previewUser.companyName || "DreamTrawell"}
              </p>
              <p className="text-xs text-gray-500 break-all">
                {previewUser.websiteUrl || "Website not set"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Managed by admin branding settings.
              </p>
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