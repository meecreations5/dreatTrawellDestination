// page.js


import Link from "next/link";

export default function Home() {
  return (
    <main className="h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold text-blue-600">
        DreamTravel CRM
      </h1>

      <Link
        href="/login"
        className="bg-blue-600 text-white px-6 py-3 rounded"
      >
        Team Login
      </Link>

      <Link
        href="/admin/login"
        className="bg-red-600 text-white px-6 py-3 rounded"
      >
        Admin Login
      </Link>
    </main>
  );
}