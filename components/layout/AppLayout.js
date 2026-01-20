"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAV } from "@/config/appNavigation";
import Image from "next/image";
import PageHeader from "./PageHeader";

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  /* =========================
     DESKTOP HOVER STATE
  ========================= */
  const [openMenuId, setOpenMenuId] = useState(null);
  const closeTimer = useRef(null);

  /* =========================
     MOBILE SUBMENU STATE
  ========================= */
  const [openMobileMenuId, setOpenMobileMenuId] = useState(null);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);

  const activeModule = APP_NAV.find(m =>
    pathname.startsWith(m.base)
  );

  /* =========================
     FAB HANDLER (RED ACTION)
  ========================= */
  const handleFabClick = () => {
    if (!activeModule?.fab) return;

    if (activeModule.fab.action === "engagement") {
      router.push("/engagements/my");
    }
    if (activeModule.fab.action === "lead") {
      router.push("/leads");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* ================= DESKTOP FLOATING ICON RAIL ================= */}
      <aside
        className="
          hidden md:flex md:flex-col items-center
          w-20
          bg-white
          rounded-full
          shadow-lg
          fixed
          left-3
          top-1/2 -translate-y-1/2
          py-4
          z-40
        "
      >
        <nav className="flex flex-col gap-4">
          {APP_NAV.filter(n => n.showInNav).map(module => {
            const Icon = module.icon;
            const active = pathname.startsWith(module.base);
            const isOpen = openMenuId === module.id;

            const openMenu = () => {
              clearTimeout(closeTimer.current);
              setOpenMenuId(module.id);
            };

            const closeMenu = () => {
              closeTimer.current = setTimeout(
                () => setOpenMenuId(null),
                180
              );
            };

            return (
              <div
                key={module.id}
                className="relative"
                onMouseEnter={openMenu}
                onMouseLeave={closeMenu}
              >
                {/* ICON */}
                <Link
                  href={module.base}
                  className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center transition
                    ${active
                      ? "bg-blue-600 text-white"
                      : "bg-white text-blue-600 hover:bg-blue-50"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </Link>

                {/* FLOATING SUBMENU (BLUE TRUST) */}
                {module.children?.length > 0 && isOpen && (
                  <div
                    className="absolute left-16 top-1/2 -translate-y-1/2 z-50"
                    onMouseEnter={openMenu}
                    onMouseLeave={closeMenu}
                  >
                    <div className="bg-white border border-blue-100 rounded-2xl shadow-xl p-2 w-48 animate-submenu">
                      <p className="px-3 py-2 text-xs font-semibold text-blue-600">
                        {module.label}
                      </p>

                      {module.children.map(sub => {
                        const subActive =
                          pathname === sub.href;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`
                              block px-3 py-2 rounded-lg text-sm transition
                              ${subActive
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-700 hover:bg-blue-50"
                              }
                            `}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 pb-20 md:pb-0 md:pl-28">
        {/* TOP BAR (DESKTOP) */}
        <div className="fixed top-4 left-4 z-50">

          <Link href="/" className="flex items-center">
            <div
              className="
          rounded-full
          bg-white
          border border-gray-200
          shadow-sm
          flex items-center justify-center
          w-10 h-10           /* mobile */
          md:w-20 md:h-20  /* desktop */
        "
            >
              <Image
                src="/logo.png"   // or /logo.png
                alt="Logo"
                priority
                width={100}
                height={100}
                className="
            w-10 h-10        /* mobile */
            md:w-10 md:h-10  /* desktop */
          "
              />
            </div>
          </Link>

        </div>


        {/* PAGE CONTENT */}
        <div className="">
          {children}
        </div>
      </main>

      {/* ================= MOBILE NAV + SUBMENU ================= */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden z-30">
        {/* OVERLAY */}
        {openMobileMenuId && (
          <div
            className="fixed inset-0 bg-black/20 z-20"
            onClick={() => setOpenMobileMenuId(null)}
          />
        )}

        {/* SUBMENU SHEET (ABOVE NAV) */}
        {openMobileMenuId && (
          <div
            className="fixed bottom-16 inset-x-4 z-30"
            onTouchStart={e => {
              touchStartY.current = e.touches[0].clientY;
            }}
            onTouchMove={e => {
              touchCurrentY.current = e.touches[0].clientY;
            }}
            onTouchEnd={() => {
              const delta =
                touchCurrentY.current -
                touchStartY.current;

              if (delta > 60) setOpenMobileMenuId(null);

              touchStartY.current = 0;
              touchCurrentY.current = 0;
            }}
          >
            <div className="bg-white rounded-2xl shadow-xl p-2 animate-mobileSheet">
              <div className="flex justify-center py-2">
                <span className="w-8 h-1.5 rounded-full bg-blue-300" />
              </div>

              {APP_NAV.find(
                n => n.id === openMobileMenuId
              )?.children?.map(sub => {
                const subActive = pathname === sub.href;

                return (
                  <button
                    key={sub.href}
                    onClick={() => {
                      setOpenMobileMenuId(null);
                      router.push(sub.href);
                    }}
                    className={`
                      w-full text-left px-4 py-3 rounded-xl text-sm transition
                      ${subActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-blue-50"
                      }
                    `}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BOTTOM BAR */}
        <div className="bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around py-3">
            {APP_NAV.filter(n => n.showInNav).map(module => {
              const Icon = module.icon;
              const active = pathname.startsWith(module.base);
              const hasChildren =
                module.children?.length > 0;
              const isOpen =
                openMobileMenuId === module.id;

              return (
                <button
                  key={module.id}
                  onClick={() => {
                    if (hasChildren) {
                      setOpenMobileMenuId(
                        isOpen ? null : module.id
                      );
                    } else {
                      router.push(module.base);
                    }
                  }}
                  className="relative flex items-center justify-center w-full active:scale-90 active:opacity-70 transition"
                >
                  {active && (
                    <span className="absolute -top-1 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                  )}

                  <Icon
                    className={`w-6 h-6 ${active || isOpen
                      ? "text-blue-600"
                      : "text-gray-400"
                      }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ================= MOBILE FAB (RED ACTION) ================= */}
      {/* {activeModule?.fab && (
        <button
          onClick={handleFabClick}
          className="
            fixed bottom-20 right-4 md:hidden
            bg-red-600 hover:bg-red-700
            text-white w-14 h-14 rounded-2xl
            flex items-center justify-center
            shadow-xl text-2xl z-40
          "
        >
          +
        </button>
      )} */}
    </div>
  );
}
