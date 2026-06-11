"use client";

import Link from "next/link";

export default function AuthError() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
        <p className="text-gray-400 mb-6">Something went wrong. Please try again.</p>
        <Link
          href="/auth/signin"
          className="px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}