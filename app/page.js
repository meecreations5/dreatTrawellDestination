import Link from "next/link";
import Image from "next/image";
import { Users, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 bg-slate-50">
      
      {/* BRAND */}
      <div className="text-center space-y-4">
        <Image
          src="/logo.png"
          alt="DreamTravel"
          width={64}
          height={64}
          className="mx-auto rounded-full shadow"
        />

        <h1 className="text-4xl font-bold text-slate-900">
          DreamTravel CRM
        </h1>

        <p className="text-slate-500 max-w-sm mx-auto">
          Manage leads, engagement, attendance, and operations in one place.
        </p>
      </div>

      {/* LOGIN OPTIONS */}
      <div className="grid gap-4 w-full max-w-sm">
        
        {/* TEAM LOGIN */}
        <Link
          href="/login"
          className="
            group rounded-xl border border-slate-200 bg-white p-5
            hover:shadow-md transition
            flex items-start gap-4
          "
        >
          <div className="mt-1">
            <Users className="w-6 h-6 text-blue-600" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Team Login
            </h3>
            <p className="text-sm text-slate-500">
              Sales, operations & staff access
            </p>
          </div>
        </Link>

        {/* ADMIN LOGIN */}
        <Link
          href="/admin/login"
          className="
            group rounded-xl border border-red-200 bg-red-50 p-5
            hover:shadow-md transition
            flex items-start gap-4
          "
        >
          <div className="mt-1">
            <ShieldCheck className="w-6 h-6 text-red-600" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-red-700">
              Admin Login
            </h3>
            <p className="text-sm text-red-600">
              System & management access
            </p>
          </div>
        </Link>

      </div>
    </main>
  );
}
