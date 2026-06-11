"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

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
          {session && (
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/dashboard"
                className={cn(
                  "text-sm transition-colors",
                  pathname === "/dashboard" ? "text-purple-600 font-medium" : "text-gray-500 hover:text-gray-800"
                )}
              >
                我的專案
              </Link>
              <Link
                href="/project/new"
                className={cn(
                  "text-sm transition-colors",
                  pathname === "/project/new" ? "text-purple-600 font-medium" : "text-gray-500 hover:text-gray-800"
                )}
              >
                新增專案
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="text-sm text-gray-500 hidden sm:block">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                className="text-sm px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors"
              >
                登出
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn()}
              className="text-sm px-4 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors font-medium"
            >
              登入
            </button>
          )}
        </div>
      </div>
    </header>
  );
}