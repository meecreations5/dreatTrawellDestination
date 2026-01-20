"use client";

import { LogOut, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";

export default function AdminTopBar({ collapsed }) {
  const { user } = useAuth(true);
  const router = useRouter();
  const auth = getAuth();

  if (!user) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <header
      className={`
        fixed top-4 right-4
        h-14
        flex items-center justify-between
        px-6
        bg-[#f9fafb]
        rounded-2xl
        shadow-[0_10px_30px_rgba(0,0,0,0.06)]
        z-20
        transition-all duration-300
        ${collapsed ? "left-[96px]" : "left-[320px]"}
      `}
    >
      {/* LEFT */}
      <div className="flex items-center gap-3">
        <div className="
          w-9 h-9 rounded-xl
          bg-blue-600 text-white
          flex items-center justify-center
          font-semibold
        ">
          A
        </div>

        <div className="leading-tight">
          <p className="text-sm font-medium text-gray-800">
            Admin Console
          </p>
          <p className="text-xs text-gray-500">
            Control & Operations
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-6">
        <div className="
          flex items-center gap-2
          px-3 py-1 rounded-full
          bg-blue-100 text-blue-700
          text-xs font-medium
        ">
          <Shield size={14} />
          Admin
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="
              w-9 h-9 rounded-full
              bg-blue-600 text-white
              flex items-center justify-center
              text-xs font-semibold uppercase
            ">
              {getInitials(user?.name || user?.email || "AD")}
            </div>

            <span className="
              absolute -bottom-0.5 -right-0.5
              w-2.5 h-2.5
              bg-blue-500
              border-2 border-white
              rounded-full
            " />
          </div>

          <div className="leading-tight">
            <p className="text-sm font-medium text-gray-800">
              {user?.name || "Admin"}
            </p>
            <p className="text-xs text-gray-500">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="
            flex items-center gap-2
            text-sm text-gray-500
            hover:text-red-600
            transition
          "
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
}

/* HELPERS */
function getInitials(value = "") {
  return value
    .split(" ")
    .map(v => v[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
