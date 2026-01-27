"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { APP_NAV } from "@/config/appNavigation";
import { getTitleFromAppNav } from "@/lib/getTitleFromAppNav";
import { LogOut, ArrowLeft } from "lucide-react";

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);


  // const mainRef = useRef(null);

  const activeModule = APP_NAV.find(m =>
    pathname?.startsWith(m.base)
  );

  /* =========================
     BACK BUTTON LOGIC (FIXED)
  ========================= */
  const showBackButton =
    activeModule &&
    pathname !== activeModule.base;

  // ✅ DEFINE ONCE (FIXES ERROR)
  const pageTitle = pathname
    ? getTitleFromAppNav(pathname)
    : "Dashboard";

  /* =========================
     TAB TITLE
  ========================= */
  useEffect(() => {
    if (!pageTitle) return;
    document.title = `${pageTitle} | DreamTrawell Destinations`;
  }, [pageTitle]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };




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

  // const activeModule = APP_NAV.find(m =>
  //   pathname?.startsWith(m.base)
  // );

  /* =========================
     FAB HANDLER
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


  const getInitials = (name = "") => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  useEffect(() => {
    if (!mounted) return;

    const onScroll = () => {
      setScrolled(window.scrollY > 4);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">

      {/* ================= DESKTOP FLOATING ICON RAIL ================= */}
      <aside
        className="
          hidden md:flex md:flex-col items-center
          w-20 bg-white rounded-full shadow-lg
          fixed left-3 top-1/2 -translate-y-1/2
          py-4 z-40
        "
      >
        <nav className="flex flex-col gap-4">
          {APP_NAV.filter(n => n.showInNav).map(module => {
            const Icon = module.icon;
            const active = pathname?.startsWith(module.base);
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
                      : "bg-white text-blue-600 hover:bg-blue-50"}
                  `}
                >
                  <Icon className="w-5 h-5" />
                </Link>

                {/* FLOATING SUBMENU */}
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
                        const subActive = pathname === sub.href;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`
                              block px-3 py-2 rounded-lg text-sm transition
                              ${subActive
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-700 hover:bg-blue-50"}
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


        {/* ================= LOGO ================= */}

        {/* DESKTOP FIXED LOGO */}
        <div className="hidden md:block fixed top-4 left-4 z-50">
          <Link href="/" className="flex items-center">
            <div
              className="
        rounded-full bg-white border border-gray-200 shadow-sm
        flex items-center justify-center
        w-20 h-20
      "
            >
              <Image
                src="/logo.png"
                alt="Logo"
                priority
                width={100}
                height={100}
                className="w-10 h-10"
              />
            </div>
          </Link>
        </div>

        {/* ================= MOBILE HEADER (TOP LEVEL) ================= */}
        
          <header
            className={`
      md:hidden
      sticky top-0
      z-[999]
      bg-white
      border-b
      border-slate-200
      transition-shadow duration-200
      ${scrolled ? "shadow-md" : ""}
    `}
          >
            <div className="flex items-center justify-between px-4 py-3">

              {/* LEFT */}
              <div className="flex items-center gap-2 min-w-0">
                {showBackButton && (
                  <button
                    onClick={() => router.push(activeModule.base)}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}

                <div className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center shrink-0">
                  <Image src="/logo.png" alt="Logo" width={32} height={32} className="logo-breath active:scale-95
  transition-transform duration-150"/>
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {/* {pageTitle} */}DreamTrawell 
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Destinations
                  </p>
                </div>
              </div>

              {/* RIGHT */}
              {user && (
                <div className="flex items-center gap-2">
                  {user.isAdmin && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      Admin
                    </span>
                  )}

                  <button
                    onClick={() => router.push("/profile")}
                    className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-semibold"
                  >
                    {getInitials(user.name)}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-9 h-9 rounded-full border flex border-slate-200 items-center justify-center"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </header>
      







        {/* PAGE CONTENT */}
        <div>{children}</div>
      </main>

      {/* ================= MOBILE NAV ================= */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden z-30">

        {openMobileMenuId && (
          <div
            className="fixed inset-0 bg-black/20 z-20"
            onClick={() => setOpenMobileMenuId(null)}
          />
        )}

        {/* MOBILE SUBMENU */}
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
                touchCurrentY.current - touchStartY.current;

              if (delta > 60) setOpenMobileMenuId(null);
            }}
          >
            <div className="bg-white rounded-2xl shadow-xl p-2 animate-mobileSheet">
              <div className="flex justify-center py-2">
                <span className="w-8 h-1.5 rounded-full bg-blue-300" />
              </div>

              {APP_NAV.find(n => n.id === openMobileMenuId)
                ?.children?.map(sub => {
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
                          : "text-gray-700 hover:bg-blue-50"}
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
        <div className="bg-white/95 backdrop-blur border-t border-gray-200">
          <div className="flex justify-around py-3">
            {APP_NAV.filter(n => n.showInNav).map(module => {
              const Icon = module.icon;
              const active = pathname?.startsWith(module.base);
              const hasChildren = module.children?.length > 0;

              return (
                <button
                  key={module.id}
                  onClick={() => {
                    if (hasChildren) {
                      setOpenMobileMenuId(module.id);
                    } else {
                      router.push(module.base);
                    }
                  }}
                  className="relative flex items-center justify-center w-full"
                >
                  {active && (
                    <span className="absolute -top-1 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                  )}

                  <Icon
                    className={`w-6 h-6 ${active ? "text-blue-600" : "text-gray-400"
                      }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ================= MOBILE FAB (OPTIONAL) ================= */}
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
