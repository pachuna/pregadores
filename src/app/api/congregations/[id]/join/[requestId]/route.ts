import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";
import { notifyUser } from "@/lib/push";

/**
 * PATCH /api/congregations/[id]/join/[requestId]
 * Ancião/Admin aprova ou recusa um pedido de entrada.
 * Body: { action: "approve" | "reject", rejectionReason?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId, requestId } = await params;

  // Verifica permissão: ADMIN ou ANCIÃO desta congregação
  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true, role: true },
    });
    if (
      user?.congregationId !== congregationId ||
      (user.role !== "ANCIAO" && user.role !== "SERVO_DE_CAMPO")
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  }

  let body: { action?: string; rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action deve ser 'approve' ou 'reject'." }, { status: 400 });
  }

  // Busca o pedido
  const joinRequest = await prisma.congregationJoinRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      congregation: { select: { name: true } },
    },
  });

  if (!joinRequest || joinRequest.congregationId !== congregationId) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (joinRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Este pedido já foi processado." }, { status: 409 });
  }

  if (body.action === "approve") {
    // Vincula o usuário à congregação e aprova o pedido
    await prisma.$transaction([
      prisma.user.update({
        where: { id: joinRequest.userId },
        data: { congregationId },
      }),
      prisma.congregationJoinRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      }),
    ]);

    // Notifica o usuário
    try {
      await notifyUser(joinRequest.userId, {
        title: "Pedido aprovado!",
        body: `Você foi vinculado à congregação ${joinRequest.congregation.name}.`,
        url: "/congregations",
      });
    } catch {
      // notificação não é crítica
    }

    return NextResponse.json({ ok: true, action: "approved" });
  } else {
    // Rejeita o pedido
    await prisma.congregationJoinRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason: body.rejectionReason?.trim() || null,
      },
    });

    // Notifica o usuário
    try {
      await notifyUser(joinRequest.userId, {
        title: "Pedido recusado",
        body: body.rejectionReason?.trim()
          ? `Sua solicitação para ${joinRequest.congregation.name} foi recusada: ${body.rejectionReason.trim()}`
          : `Sua solicitação para ${joinRequest.congregation.name} foi recusada.`,
        url: "/congregations",
      });
    } catch {
      // notificação não é crítica
    }

    return NextResponse.json({ ok: true, action: "rejected" });
  }
}

/**
 * DELETE /api/congregations/[id]/join/[requestId]
 * Usuário cancela o próprio pedido de entrada PENDENTE.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId, requestId } = await params;

  const joinRequest = await prisma.congregationJoinRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, congregationId: true, status: true },
  });

  if (!joinRequest || joinRequest.congregationId !== congregationId) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Só o próprio usuário pode cancelar (ou ADMIN)
  if (joinRequest.userId !== auth.userId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (joinRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Apenas pedidos pendentes podem ser cancelados." }, { status: 409 });
  }

  await prisma.congregationJoinRequest.delete({ where: { id: requestId } });

  return NextResponse.json({ ok: true });
}
