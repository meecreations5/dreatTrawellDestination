//login/page.js

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
    // redirect handled by useEffect
  };

  if (loading) return <p className="p-6">Loading…</p>;

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow text-center space-y-4">
        <h1 className="text-xl font-bold text-blue-600">
          Team Login
        </h1>

        <button
          onClick={login}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
