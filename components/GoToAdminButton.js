"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { useRouter } from "next/navigation";

export default function GoToAdminButton() {
  const { user } = useAuth();
  const { setMode } = useRole();
  const router = useRouter();

  if (!user?.isAdmin) return null;

  return (
    <button
      onClick={() => {
        setMode("admin");
        router.push("/admin");
      }}
      className="bg-red-600 text-white px-3 py-1 rounded"
    >
      Go to Admin
    </button>
  );
}
