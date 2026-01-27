"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Users } from "lucide-react";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 text-center">
        
        {/* BRAND */}
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

        {/* LOGIN ACTION */}
        <button
          onClick={login}
          className="
            w-full flex items-center justify-center gap-3
            rounded-lg border border-slate-200
            px-4 py-3 text-sm font-medium
            hover:bg-slate-50 transition
          "
        >
          <Users className="w-5 h-5 text-blue-600" />
          Sign in with Google
        </button>

        {/* FOOT NOTE */}
        <p className="text-xs text-slate-400">
          Authorized team members only
        </p>
      </div>
    </main>
  );
}
