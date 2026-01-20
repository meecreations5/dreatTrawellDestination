"use client";

import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) return null;

  const logout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <main className="p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">
          Team Dashboard
        </h1>

        <div className="flex gap-2">
          {user.isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Go to Admin
            </button>
          )}

          <button
            onClick={logout}
            className="bg-gray-800 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}
