"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function AuthError() {
  useEffect(() => {
    const timer = setTimeout(() => signIn("demo", { callbackUrl: "/dashboard" }), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-amber-100 flex items-center justify-center text-2xl mx-auto mb-4">
          🔄
        </div>
        <h1 className="text-xl font-bold mb-2">重新登入中</h1>
        <p className="text-gray-500 text-sm">請稍候...</p>
      </div>
    </div>
  );
}