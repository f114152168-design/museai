"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getTier } from "@/lib/billing";

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

  const currentTier = getTier();
  const isFree = currentTier === "free";

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              M
            </div>
            <span className="font-bold text-lg">Museai</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/pricing" className={cn("text-sm transition-colors", pathname === "/pricing" ? "text-purple-600 font-medium" : "text-gray-500 hover:text-gray-800")}>
              方案
            </Link>
            {session ? (
              <>
                <Link href="/dashboard" className={cn("text-sm transition-colors", pathname === "/dashboard" ? "text-purple-600 font-medium" : "text-gray-500 hover:text-gray-800")}>
                  我的專案
                </Link>
                <Link href="/project/new" className={cn("text-sm transition-colors", pathname === "/project/new" ? "text-purple-600 font-medium" : "text-gray-500 hover:text-gray-800")}>
                  新增專案
                </Link>
              </>
            ) : (
              <button onClick={() => signIn()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                登入
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              {isFree && (
                <Link href="/pricing" className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 transition-colors">
                  升級 Pro
                </Link>
              )}
              <span className="text-sm text-gray-500 hidden sm:block">{session.user?.email}</span>
              <button onClick={() => signOut()} className="text-sm px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors">
                登出
              </button>
            </>
          ) : (
            <button onClick={() => signIn()} className="text-sm px-4 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors font-medium">
              免費開始
            </button>
          )}
        </div>
      </div>
    </header>
  );
}