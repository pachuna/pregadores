"use client";

import { useEffect, useRef } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i);
  return array;
}

/**
 * Registra automaticamente push subscription quando o usuário está logado.
 * Não renderiza nada — é um componente de efeito colateral.
 */
export default function PushSubscriber() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const subscribed = useRef(false);

  useEffect(() => {
    if (!accessToken || subscribed.current || !VAPID_PUBLIC) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function subscribe() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();

        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          }));

        const json = subscription.toJSON();
        await api.post("/api/push/subscribe", {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        });

        subscribed.current = true;
      } catch {
        // Silencioso — push é opcional
      }
    }

    subscribe();
  }, [accessToken]);

  return null;
}
