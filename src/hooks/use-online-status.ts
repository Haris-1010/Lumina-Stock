"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current network status and calls `onComeOnline` whenever
 * the browser transitions from offline → online.
 */
export function useOnlineStatus(onComeOnline?: () => void): boolean {
  // Always start as `true` on both server and client so the initial render
  // matches — the real value is applied after mount via useEffect.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Sync to actual network state after mount
    setIsOnline(navigator.onLine);
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      onComeOnline?.();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [onComeOnline]);

  return isOnline;
}
