import webpush from "web-push";
import { prisma } from "./prisma";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_MAILTO = `mailto:${process.env.ADMIN_EMAIL ?? "admin@example.com"}`;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envia push notification para todos os usuários com determinado role.
 */
export async function notifyByRole(
  role: "ADMIN" | "ANCIAO" | "PUBLICADOR",
  payload: PushPayload
): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({
    where: { user: { role } },
  });

  await sendToSubscriptions(subs, payload);
}

/**
 * Envia push notification para todos os membros de uma congregação específica.
 */
export async function notifyByCongregation(
  congregationId: string,
  payload: PushPayload
): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({
    where: { user: { congregationId } },
  });

  await sendToSubscriptions(subs, payload);
}

/**
 * Envia push notification para usuários de determinadas roles DENTRO de uma congregação,
 * mais todos os ADMINs globais — único query no banco.
 */
export async function notifyByRolesInCongregation(
  congregationId: string,
  roles: Array<"ANCIAO" | "SERVO_DE_CAMPO" | "PUBLICADOR">,
  payload: PushPayload
): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({
    where: {
      OR: [
        { user: { congregationId, role: { in: roles } } },
        { user: { role: "ADMIN" } },
      ],
    },
  });
  await sendToSubscriptions(subs, payload);
}

/**
 * Envia push notification para todos os usuários (todas as roles).
 */
export async function notifyAll(payload: PushPayload): Promise<void> {
  const subs = await prisma.pushSubscription.findMany();
  await sendToSubscriptions(subs, payload);
}

/**
 * Envia push notification para um usuário específico.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  await sendToSubscriptions(subs, payload);
}

async function sendToSubscriptions(
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<void> {
  const message = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message
        );
      } catch (err: unknown) {
        // 410 Gone = subscription expirada
        if (
          typeof err === "object" &&
          err !== null &&
          "statusCode" in err &&
          ((err as { statusCode: number }).statusCode === 410 ||
            (err as { statusCode: number }).statusCode === 404)
        ) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}
