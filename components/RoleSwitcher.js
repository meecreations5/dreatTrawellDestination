// components/Rolewitcher.js

"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";

export default function RoleSwitcher() {
  const { user } = useAuth();
  const { mode, setMode } = useRole();

  if (!user || user.role !== "admin") return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium">Mode:</span>
      <button
        onClick={() => setMode("team")}
        className={`px-2 py-1 rounded ${
          mode === "team" ? "bg-blue-600 text-white" : "bg-gray-200"
        }`}
      >
        Team
      </button>
      <button
        onClick={() => setMode("admin")}
        className={`px-2 py-1 rounded ${
          mode === "admin" ? "bg-red-600 text-white" : "bg-gray-200"
        }`}
      >
        Admin
      </button>
    </div>
  );
}
