"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  Building2,
  Loader2,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";
import { signOut } from "firebase/auth";

import {
  getLoginErrorMessage,
  loginWithGoogle,
  loginWithMicrosoft
} from "@/lib/auth";

import { auth } from "@/lib/firebase";

function isAllowedAdminUser(user) {
  if (!user) return false;

  const isSuperAdmin =
    user.role === "super_admin" || user.isSuperAdmin === true;

  const isAdmin =
    isSuperAdmin ||
    user.role === "admin" ||
    user.isAdmin === true;

  return isAdmin && user.active === true;
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [submittingProvider, setSubmittingProvider] = useState("");

  const login = async (provider) => {
    setError("");
    setSubmittingProvider(provider);

    try {
      const signedInUser =
        provider === "microsoft"
          ? await loginWithMicrosoft()
          : await loginWithGoogle();

      if (!isAllowedAdminUser(signedInUser)) {
        await signOut(auth);
        setError(
          "You are not authorized for admin access. Please contact Super Admin."
        );
        return;
      }

      const isSuperAdmin =
        signedInUser.role === "super_admin" ||
        signedInUser.isSuperAdmin === true;

      if (isSuperAdmin) {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/admin/travel-agents");
      }
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setSubmittingProvider("");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
        <div className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50">
            <Image
              src="/logo.png"
              alt="DreamTravel"
              width={58}
              height={58}
              priority
              className="rounded-full"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Admin Login
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Restricted access for Super Admin and Admin users.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
              <LockKeyhole className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-semibold text-red-800">
                Admin Access Control
              </p>
              <p className="mt-1 text-xs leading-5 text-red-600">
                Super Admin gets full access. Admin gets assigned module access only.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={!!submittingProvider}
            onClick={() => login("microsoft")}
            className="
              flex w-full items-center justify-center gap-3
              rounded-xl border border-red-200 bg-red-50
              px-4 py-3 text-sm font-semibold text-red-700
              transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {submittingProvider === "microsoft" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}

            {submittingProvider === "microsoft"
              ? "Signing in..."
              : "Sign in with Microsoft"}
          </button>

          <button
            type="button"
            disabled={!!submittingProvider}
            onClick={() => login("google")}
            className="
              flex w-full items-center justify-center gap-3
              rounded-xl border border-slate-200 bg-white
              px-4 py-3 text-sm font-semibold text-slate-700
              transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {submittingProvider === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-red-600" />
            )}

            {submittingProvider === "google"
              ? "Signing in..."
              : "Sign in with Google"}
          </button>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-left text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <p className="mt-5 text-xs text-slate-400">
          Only approved admin accounts are allowed.
        </p>
      </div>
    </main>
  );
}