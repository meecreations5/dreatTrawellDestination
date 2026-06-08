// components/settings/TeamSignatureManager.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";

import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText,
  getMemberEmail,
  getMemberMobile,
  getMemberName,
  getMemberRole,
  getMemberUid,
  sanitizeSignatureHtml
} from "@/lib/signatureUtils";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";

function isInternalUser(member) {
  const role = String(member?.role || "").toLowerCase();

  const inactive =
    member?.disabled ||
    member?.isDisabled ||
    member?.deleted ||
    member?.isDeleted ||
    member?.status === "inactive";

  const excludedRoles = [
    "customer",
    "client",
    "vendor",
    "travel_agent",
    "travel-agent"
  ];

  return !inactive && !excludedRoles.includes(role);
}

export default function TeamSignatureManager() {
  const { user } = useAuth();

  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  const [members, setMembers] = useState([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    designation: "",
    signatureHtml: "",
    whatsappSignature: "",
    signatureEnabled: true
  });

  useEffect(() => {
    let mounted = true;

    async function loadMembers() {
      if (!user) return;

      setLoading(true);

      try {
        const snap = await getDocs(collection(db, "users"));

        let rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            uid: docSnap.id,
            ...docSnap.data()
          }))
          .filter(isInternalUser);

        if (!isAdmin) {
          rows = rows.filter(member => getMemberUid(member) === user.uid);
        }

        if (mounted) {
          setMembers(rows);

          const defaultUid = isAdmin
            ? getMemberUid(rows[0])
            : user.uid;

          setSelectedUid(defaultUid || "");
        }
      } catch (error) {
        console.error("Failed to load team signatures:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMembers();

    return () => {
      mounted = false;
    };
  }, [user, isAdmin]);

  const selectedMember = useMemo(() => {
    return (
      members.find(member => getMemberUid(member) === selectedUid) || null
    );
  }, [members, selectedUid]);

  useEffect(() => {
    if (!selectedMember) return;

    setForm({
      name: getMemberName(selectedMember),
      email: getMemberEmail(selectedMember),
      mobile: getMemberMobile(selectedMember),
      designation: getMemberRole(selectedMember),
      signatureHtml:
        selectedMember.signatureHtml ||
        selectedMember.emailSignatureHtml ||
        "",
      whatsappSignature:
        selectedMember.whatsappSignature ||
        selectedMember.signatureText ||
        "",
      signatureEnabled: selectedMember.signatureEnabled !== false
    });
  }, [selectedMember]);

  const previewMember = useMemo(() => {
    return {
      ...selectedMember,
      name: form.name,
      displayName: form.name,
      email: form.email,
      mobile: form.mobile,
      designation: form.designation,
      signatureHtml: form.signatureHtml,
      whatsappSignature: form.whatsappSignature
    };
  }, [selectedMember, form]);

  const saveSignature = async () => {
    if (!selectedUid) {
      alert("Select team member");
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
        doc(db, "users", selectedUid),
        {
          name: form.name.trim(),
          displayName: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          designation: form.designation.trim(),

          signatureEnabled: Boolean(form.signatureEnabled),
          signatureHtml: sanitizeSignatureHtml(form.signatureHtml),
          emailSignatureHtml: sanitizeSignatureHtml(form.signatureHtml),
          whatsappSignature: form.whatsappSignature.trim(),
          signatureText: form.whatsappSignature.trim(),

          signatureUpdatedAt: serverTimestamp(),
          signatureUpdatedByUid: user?.uid || "",
          signatureUpdatedByName:
            user?.displayName || user?.name || user?.email || ""
        },
        { merge: true }
      );

      setMembers(prev =>
        prev.map(member =>
          getMemberUid(member) === selectedUid
            ? {
                ...member,
                name: form.name.trim(),
                displayName: form.name.trim(),
                email: form.email.trim(),
                mobile: form.mobile.trim(),
                designation: form.designation.trim(),
                signatureEnabled: Boolean(form.signatureEnabled),
                signatureHtml: sanitizeSignatureHtml(form.signatureHtml),
                emailSignatureHtml: sanitizeSignatureHtml(form.signatureHtml),
                whatsappSignature: form.whatsappSignature.trim(),
                signatureText: form.whatsappSignature.trim()
              }
            : member
        )
      );

      alert("Signature saved successfully");
    } catch (error) {
      console.error("Signature save failed:", error);
      alert("Failed to save signature");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Team Signature Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage email and WhatsApp signatures used in quotation communication.
        </p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-gray-500">Loading signatures...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="space-y-4 lg:col-span-2">
            {isAdmin && (
              <div>
                <label className="text-xs text-gray-500">
                  Team Member
                </label>
                <select
                  value={selectedUid}
                  onChange={e => setSelectedUid(e.target.value)}
                  className={`${inputClass} mt-1`}
                >
                  {members.map(member => {
                    const uid = getMemberUid(member);

                    return (
                      <option key={uid} value={uid}>
                        {getMemberName(member)}
                        {getMemberRole(member)
                          ? ` — ${getMemberRole(member)}`
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.name}
                  onChange={e =>
                    setForm(prev => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Designation</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.designation}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      designation: e.target.value
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.email}
                  onChange={e =>
                    setForm(prev => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Mobile</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.mobile}
                  onChange={e =>
                    setForm(prev => ({ ...prev, mobile: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Email Signature HTML
              </label>
              <textarea
                rows={7}
                className={`${inputClass} mt-1 font-mono`}
                placeholder="<p>Regards,<br/><b>Name</b><br/>DreamTrawell</p>"
                value={form.signatureHtml}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    signatureHtml: e.target.value
                  }))
                }
              />
              <p className="text-[11px] text-gray-500 mt-1">
                You can use simple HTML: p, br, b, strong, table, div, span.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                WhatsApp Signature
              </label>
              <textarea
                rows={5}
                className={`${inputClass} mt-1`}
                placeholder={`Regards,\nName\nDreamTrawell\nMobile: 9876543210`}
                value={form.whatsappSignature}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    whatsappSignature: e.target.value
                  }))
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.signatureEnabled}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    signatureEnabled: e.target.checked
                  }))
                }
              />
              Signature active
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={saveSignature}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Signature"}
              </button>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Email Preview
              </h2>
              <div
                className="border border-gray-200 rounded-lg p-3 mt-2 text-sm bg-white"
                dangerouslySetInnerHTML={{
                  __html: buildEmailSignatureHtml(previewMember)
                }}
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                WhatsApp Preview
              </h2>
              <pre className="border border-gray-200 rounded-lg p-3 mt-2 text-xs bg-gray-50 whitespace-pre-wrap">
                {buildWhatsAppSignatureText(previewMember)}
              </pre>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}