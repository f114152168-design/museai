"use client";

import { signIn, useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function SignIn() {
  const { data: session } = useSession();
  if (session) redirect("/dashboard");

  useEffect(() => {
    const timer = setTimeout(() => {
      signIn("demo", { callbackUrl: "/dashboard" });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 animate-pulse">
          M
        </div>
        <h1 className="text-xl font-bold mb-2">自動登入中...</h1>
        <p className="text-gray-500 text-sm">即將進入 Museai</p>
      </div>
    </div>
  );
}