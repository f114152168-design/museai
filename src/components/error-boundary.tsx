"use client";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex-1 flex items-center justify-center bg-[#1a1a2e]">
          <div className="text-center max-w-md px-6">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">頁面載入錯誤</h2>
            <p className="text-gray-400 text-sm mb-4">{this.state.error?.message ?? "發生未預期的錯誤"}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-500 transition-colors">
              重新載入
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}