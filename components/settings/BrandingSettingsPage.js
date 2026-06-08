// components/settings/BrandingSettingsPage.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "firebase/storage";

import Card from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { storage } from "@/lib/firebase";

import {
  DEFAULT_BRANDING,
  getBrandingSettings,
  saveBrandingSettings
} from "@/lib/brandingSettings";

import { buildEmailSignatureHtml } from "@/lib/signatureUtils";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";

function BrandingSkeleton() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="bg-gray-100 rounded-2xl h-36" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index}>
              <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
              <div className="h-10 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </Card>

        <Card>
          <div className="h-4 bg-gray-200 rounded w-36 mb-4" />
          <div className="h-40 bg-gray-100 rounded-lg" />
        </Card>
      </div>
    </main>
  );
}

export default function BrandingSettingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [form, setForm] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    let mounted = true;

    async function loadBranding() {
      if (!user) return;

      setLoading(true);

      try {
        const branding = await getBrandingSettings();

        if (mounted) {
          setForm(branding);
        }
      } catch (error) {
        console.error("Failed to load branding:", error);
        alert("Failed to load branding settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBranding();

    return () => {
      mounted = false;
    };
  }, [user]);

  const previewMember = useMemo(() => {
    return {
      name: user?.displayName || user?.name || "Team Member",
      designation: "Travel Consultant",
      email: user?.email || form.supportEmail,
      mobile: form.supportMobile,
      signatureHtml: "",
      ...form
    };
  }, [user, form]);

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const uploadLogo = async event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload only image file");
      event.target.value = "";
      return;
    }

    const maxSizeMb = 2;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      alert(`Logo size should be less than ${maxSizeMb}MB`);
      event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    setUploadProgress(0);

    try {
      const extension = file.name.split(".").pop() || "png";
      const fileName = `company-logo-${Date.now()}.${extension}`;
      const storageRef = ref(storage, `branding/${fileName}`);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type
      });

      uploadTask.on(
        "state_changed",
        snapshot => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );

          setUploadProgress(progress);
        },
        error => {
          console.error("Logo upload failed:", error);
          alert("Logo upload failed");
          setUploadingLogo(false);
          setUploadProgress(0);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          updateField("companyLogoUrl", downloadUrl);

          setUploadingLogo(false);
          setUploadProgress(100);

          event.target.value = "";
        }
      );
    } catch (error) {
      console.error("Logo upload failed:", error);
      alert("Logo upload failed");
      setUploadingLogo(false);
      setUploadProgress(0);
      event.target.value = "";
    }
  };

  const saveSettings = async () => {
    if (!form.companyName.trim()) {
      alert("Company name is required");
      return;
    }

    setSaving(true);

    try {
      await saveBrandingSettings(form, user);
      alert("Branding settings saved successfully");
    } catch (error) {
      console.error("Branding save failed:", error);
      alert("Failed to save branding settings");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <BrandingSkeleton />;
  }

  if (!user) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <Card>
          <p className="text-sm text-gray-500">
            User session not loaded. Please refresh the page.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-6 text-white">
        <p className="text-xs uppercase tracking-wide opacity-80">
          Admin Settings
        </p>

        <h1 className="text-2xl font-semibold mt-1">
          Company Branding
        </h1>

        <p className="text-sm opacity-90 mt-2 max-w-2xl">
          Manage logo, website and social media links used in quotation email
          signatures across all team members.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Brand Details
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              These details will be included automatically in quotation email
              signatures.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">
                Company Name
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.companyName}
                onChange={e => updateField("companyName", e.target.value)}
                placeholder="DreamTrawell Destination"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Upload Company Logo
              </label>

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={uploadLogo}
                disabled={uploadingLogo}
                className="mt-1 block w-full text-sm text-gray-600
                  file:mr-3 file:rounded-lg file:border-0
                  file:bg-blue-50 file:px-3 file:py-2
                  file:text-sm file:font-medium file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-60"
              />

              <p className="text-[11px] text-gray-500 mt-1">
                PNG, JPG or WEBP. Max 2MB.
              </p>

              {uploadingLogo && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Uploading {uploadProgress}%
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">
                Logo URL
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.companyLogoUrl}
                onChange={e =>
                  updateField("companyLogoUrl", e.target.value)
                }
                placeholder="Uploaded logo URL will appear here"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Website
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.websiteUrl}
                onChange={e => updateField("websiteUrl", e.target.value)}
                placeholder="https://go.dreamtrawelldestination.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Email Asset Base URL
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.emailAssetBaseUrl || ""}
                onChange={e =>
                  updateField("emailAssetBaseUrl", e.target.value)
                }
                placeholder="https://go.dreamtrawelldestination.com"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Used for email social icons.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Support Email
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.supportEmail}
                onChange={e =>
                  updateField("supportEmail", e.target.value)
                }
                placeholder="info@dreamtrawelldestination.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Support Mobile
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={form.supportMobile}
                onChange={e =>
                  updateField("supportMobile", e.target.value)
                }
                placeholder="9876543210"
              />
            </div>
          </div>

          <div className="border-t pt-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Social Media Accounts
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                These links will appear as PNG icons in generated email
                signatures.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">
                  Facebook
                </label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.facebookUrl}
                  onChange={e =>
                    updateField("facebookUrl", e.target.value)
                  }
                  placeholder="Facebook page URL"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">
                  Instagram
                </label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.instagramUrl}
                  onChange={e =>
                    updateField("instagramUrl", e.target.value)
                  }
                  placeholder="Instagram profile URL"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">
                  LinkedIn
                </label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.linkedinUrl}
                  onChange={e =>
                    updateField("linkedinUrl", e.target.value)
                  }
                  placeholder="LinkedIn page URL"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">
                  YouTube
                </label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.youtubeUrl}
                  onChange={e =>
                    updateField("youtubeUrl", e.target.value)
                  }
                  placeholder="YouTube channel URL"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t pt-5">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || uploadingLogo}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Branding"}
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Logo Preview
            </h2>

            {form.companyLogoUrl ? (
              <img
                src={form.companyLogoUrl}
                alt={form.companyName}
                className="w-28 h-28 rounded-xl object-contain border border-gray-200 bg-white"
              />
            ) : (
              <div className="w-28 h-28 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-semibold">
                Logo
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-900">
                {form.companyName || "DreamTrawell Destination"}
              </p>
              <p className="text-xs text-gray-500 break-all">
                {form.websiteUrl || "Website not set"}
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
                __html: buildEmailSignatureHtml(previewMember)
              }}
            />
          </Card>
        </div>
      </div>
    </main>
  );
}