import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import {
  notifyByRole,
  notifyByCongregation,
  notifyAll,
  type PushPayload,
} from "@/lib/push";

/**
 * POST /api/push/send  — Admin envia push manual para um público-alvo.
 * Body: {
 *   title: string;
 *   body: string;
 *   url?: string;
 *   target: "ALL" | "ADMIN" | "ANCIAO" | "PUBLICADOR" | "congregation";
 *   congregationId?: string;   // obrigatório quando target === "congregation"
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    title?: string;
    body?: string;
    url?: string;
    target?: string;
    congregationId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { title, body: msgBody, url, target, congregationId } = body;

  if (!title?.trim() || !msgBody?.trim()) {
    return NextResponse.json(
      { error: "title e body são obrigatórios" },
      { status: 400 }
    );
  }

  const VALID_TARGETS = ["ALL", "ADMIN", "ANCIAO", "PUBLICADOR", "congregation"];
  if (!target || !VALID_TARGETS.includes(target)) {
    return NextResponse.json(
      { error: `target deve ser um de: ${VALID_TARGETS.join(", ")}` },
      { status: 400 }
    );
  }

  if (target === "congregation" && !congregationId) {
    return NextResponse.json(
      { error: "congregationId é obrigatório quando target é 'congregation'" },
      { status: 400 }
    );
  }

  const payload: PushPayload = {
    title: title.trim(),
    body: msgBody.trim(),
    ...(url?.trim() ? { url: url.trim() } : {}),
  };

  try {
    if (target === "ALL") {
      await notifyAll(payload);
    } else if (target === "congregation") {
      await notifyByCongregation(congregationId!, payload);
    } else {
      await notifyByRole(target as "ADMIN" | "ANCIAO" | "PUBLICADOR", payload);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Falha ao enviar notificações" },
      { status: 500 }
    );
  }
}
