"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, ShieldCheck } from "lucide-react";
import { signOut } from "firebase/auth";

import {
  getLoginErrorMessage,
  loginWithGoogle,
  loginWithMicrosoft,
} from "@/lib/auth";

import { auth } from "@/lib/firebase";

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

      if (
        signedInUser.isAdmin !== true ||
        signedInUser.active !== true
      ) {
        await signOut(auth);
        setError("You are not authorized as an admin");
        return;
      }

      router.replace("/admin");
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setSubmittingProvider("");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-red-200 shadow-sm p-6 space-y-6 text-center">
        <div className="space-y-3">
          <Image
            src="/logo.png"
            alt="DreamTravel"
            width={56}
            height={56}
            className="mx-auto rounded-full shadow"
          />

          <h1 className="text-2xl font-bold text-slate-900">
            Admin Login
          </h1>

          <p className="text-sm text-slate-500">
            Restricted administrator access
          </p>
        </div>

        <div className="space-y-3">
          <button
            disabled={!!submittingProvider}
            onClick={() => login("microsoft")}
            className="
              w-full flex items-center justify-center gap-3
              rounded-lg border border-red-200 bg-red-50
              px-4 py-3 text-sm font-medium text-red-700
              hover:bg-red-100 transition disabled:opacity-60
            "
          >
            <Building2 className="w-5 h-5" />
            {submittingProvider === "microsoft"
              ? "Signing in..."
              : "Sign in with Microsoft"}
          </button>

          <button
            disabled={!!submittingProvider}
            onClick={() => login("google")}
            className="
              w-full flex items-center justify-center gap-3
              rounded-lg border border-red-200
              px-4 py-3 text-sm font-medium text-red-700
              hover:bg-red-50 transition disabled:opacity-60
            "
          >
            <ShieldCheck className="w-5 h-5" />
            {submittingProvider === "google"
              ? "Signing in..."
              : "Sign in with Google"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600">
            {error}
          </p>
        )}

        <p className="text-xs text-red-500">
          Only approved admin accounts are allowed
        </p>
      </div>
    </main>
  );
}