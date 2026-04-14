import { setDefaultResultOrder } from "dns";

/**
 * Next.js instrumentation hook — executa uma única vez no startup do servidor.
 * Força resolução DNS para IPv4 first, corrigindo ETIMEDOUT em VPS sem
 * conectividade IPv6 real quando Node.js/undici tenta IPv6 primeiro.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    setDefaultResultOrder("ipv4first");
  }
}
