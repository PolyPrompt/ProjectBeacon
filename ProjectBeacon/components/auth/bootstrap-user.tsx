"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

export function BootstrapUser() {
  const { isLoaded, isSignedIn } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || startedRef.current) {
      return;
    }

    startedRef.current = true;

    void fetch("/api/users/bootstrap", {
      method: "POST",
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
