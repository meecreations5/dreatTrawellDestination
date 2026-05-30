"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Users } from "lucide-react";

import {
  getLoginErrorMessage,
  loginWithGoogle,
  loginWithMicrosoft
} from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submittingProvider, setSubmittingProvider] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const login = async (provider) => {
    setError("");
    setSubmittingProvider(provider);

    try {
      if (provider === "microsoft") {
        await loginWithMicrosoft();
      } else {
        await loginWithGoogle();
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setSubmittingProvider("");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 text-center">
        <div className="space-y-3">
          <Image
            src="/logo.png"
            alt="DreamTravel"
            width={56}
            height={56}
            className="mx-auto rounded-full shadow"
          />

          <h1 className="text-2xl font-bold text-slate-900">
            Team Login
          </h1>

          <p className="text-sm text-slate-500">
            Sign in to access the DreamTravel CRM
          </p>
        </div>

        <div className="space-y-3">
          <button
            disabled={!!submittingProvider}
            onClick={() => login("microsoft")}
            className="
              w-full flex items-center justify-center gap-3
              rounded-lg border border-blue-200 bg-blue-50
              px-4 py-3 text-sm font-medium text-blue-700
              hover:bg-blue-100 transition disabled:opacity-60
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
              rounded-lg border border-slate-200
              px-4 py-3 text-sm font-medium
              hover:bg-slate-50 transition disabled:opacity-60
            "
          >
            <Users className="w-5 h-5 text-blue-600" />
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

        <p className="text-xs text-slate-400">
          {loading ? "Checking session..." : "Authorized team members only"}
        </p>
      </div>
    </main>
  );
}
