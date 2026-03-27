"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function RootPage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  useEffect(() => {
    router.replace(token ? "/home" : "/login");
  }, [token, router]);

  return null;
}
