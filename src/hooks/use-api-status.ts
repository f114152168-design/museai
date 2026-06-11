"use client";

import { useState, useEffect } from "react";

interface ApiStatus {
  configured: boolean;
  message: string;
  loading: boolean;
}

export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>({
    configured: false,
    message: "檢查中...",
    loading: true,
  });

  useEffect(() => {
    fetch("/api/generate")
      .then((res) => res.json())
      .then((data) => {
        setStatus({
          configured: data.configured,
          message: data.message,
          loading: false,
        });
      })
      .catch(() => {
        setStatus({
          configured: false,
          message: "無法檢查 API 狀態",
          loading: false,
        });
      });
  }, []);

  return status;
}