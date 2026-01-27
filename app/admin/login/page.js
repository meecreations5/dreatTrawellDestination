"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setChecking(false);
        return;
      }

      try {
        // ✅ USERS COLLECTION (CONFIRMED BY SCREENSHOT)
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Admin profile not found");
          setChecking(false);
          return;
        }

        const data = snap.data();

        // ✅ ADMIN CHECK
        if (data.isAdmin === true && data.active === true) {
          router.replace("/admin");
        } else {
          setError("You are not authorized as an admin");
          setChecking(false);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to verify admin access");
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  const login = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Checking admin access…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-red-200 shadow-sm p-6 space-y-6 text-center">

        {/* LOGO */}
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

        {/* LOGIN BUTTON */}
        <button
          onClick={login}
          className="
            w-full flex items-center justify-center gap-3
            rounded-lg border border-red-200 bg-red-50
            px-4 py-3 text-sm font-medium text-red-700
            hover:bg-red-100 transition
          "
        >
          <ShieldCheck className="w-5 h-5" />
          Sign in with Google
        </button>

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
