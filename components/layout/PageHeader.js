"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { APP_NAV } from "@/config/appNavigation";

export default function PageHeader() {
  const pathname = usePathname();

  const activeModule = APP_NAV.find(m =>
    pathname.startsWith(m.base)
  );

  return (
    <div className="sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center gap-3">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
          />
        </Link>

        <h1 className="text-lg font-semibold text-blue-700">
          {activeModule?.label ?? "Dashboard"}
        </h1>
      </div>
    </div>
  );
}
