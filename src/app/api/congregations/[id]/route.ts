import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";
import { notifyUser } from "@/lib/push";
import { CongregationStatus } from "@/generated/prisma/enums";

const VALID_STATUSES: CongregationStatus[] = ["PENDING", "ACTIVE", "BLOCKED", "REJECTED"];

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/congregations/[id]
 * ADMIN: qualquer congregação.
 * Ancião/Publicador: somente a própria.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (user?.congregationId !== id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  const congregation = await prisma.congregation.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, email: true } },
      members: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isBlocked: true,
          lastSeenAt: true,
          createdAt: true,
          _count: { select: { revisits: true } },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { members: true } },
    },
  });

  if (!congregation) {
    return NextResponse.json({ error: "Congregação não encontrada" }, { status: 404 });
  }

  return NextResponse.json(congregation);
}

/**
 * PATCH /api/congregations/[id]
 * ADMIN: edita dados e status.
 * Body: { name?, jwEmail?, state?, city?, status?, rejectionReason? }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const updateData: {
    name?: string;
    jwEmail?: string;
    state?: string;
    city?: string;
    status?: CongregationStatus;
    rejectionReason?: string | null;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim();
  }
  if (typeof body.jwEmail === "string" && body.jwEmail.trim()) {
    updateData.jwEmail = body.jwEmail.trim().toLowerCase();
  }
  if (typeof body.state === "string" && body.state.trim()) {
    updateData.state = body.state.trim().toUpperCase();
  }
  if (typeof body.city === "string" && body.city.trim()) {
    updateData.city = body.city.trim();
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as CongregationStatus)) {
      return NextResponse.json(
        { error: `status deve ser: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updateData.status = body.status as CongregationStatus;
    // Ao rejeitar, obriga motivo; ao aprovar/reativar, limpa o motivo
    if (body.status === "REJECTED") {
      const reason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
      if (!reason) {
        return NextResponse.json({ error: "Informe o motivo da recusa." }, { status: 400 });
      }
      updateData.rejectionReason = reason;
    } else {
      updateData.rejectionReason = null;
    }
  } else if (typeof body.rejectionReason === "string") {
    updateData.rejectionReason = body.rejectionReason.trim() || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração informada" }, { status: 400 });
  }

  const target = await prisma.congregation.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Congregação não encontrada" }, { status: 404 });
  }

  let updated;
  try {
    updated = await prisma.congregation.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { members: true } } },
    });
  } catch (dbErr) {
    console.error("[PATCH /congregations/:id] Prisma error:", dbErr);
    return NextResponse.json({ error: "Erro ao atualizar congregação." }, { status: 500 });
  }

  // Notifica o solicitante se o status mudou
  if (updateData.status && updateData.status !== target.status) {
    const statusMsg: Record<CongregationStatus, string> = {
      ACTIVE: "foi aprovada! Você já pode gerenciar sua congregação.",
      BLOCKED: "foi bloqueada. Entre em contato com o administrador.",
      PENDING: "voltou para análise.",
      REJECTED: `foi recusada. Motivo: ${updateData.rejectionReason ?? "—"}`,
    };
    await notifyUser(target.createdById, {
      title: `Congregação ${updated.name}`,
      body: `Sua solicitação ${statusMsg[updateData.status]}`,
      url: "/congregations",
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/congregations/[id]
 * Apenas ADMIN pode excluir uma congregação.
 * Desvincula membros, remove territórios (cascata) e então exclui a congregação.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado. Apenas ADMIN pode excluir congregações." }, { status: 403 });
  }

  const { id } = await params;

  const congregation = await prisma.congregation.findUnique({
    where: { id },
    include: { _count: { select: { members: true, territories: true } } },
  });

  if (!congregation) {
    return NextResponse.json({ error: "Congregação não encontrada." }, { status: 404 });
  }

  // Executa tudo em uma transação para garantir atomicidade
  await prisma.$transaction(async (tx) => {
    // 1. Desvincula membros (não exclui usuários)
    await tx.user.updateMany({
      where: { congregationId: id },
      data: { congregationId: null },
    });

    // 2. Remove visitas das casas dos territórios desta congregação
    await tx.houseVisit.deleteMany({
      where: { house: { street: { territory: { congregationId: id } } } },
    });

    // 3. Remove casas
    await tx.house.deleteMany({
      where: { street: { territory: { congregationId: id } } },
    });

    // 4. Remove ruas
    await tx.street.deleteMany({
      where: { territory: { congregationId: id } },
    });

    // 5. Remove territórios
    await tx.territory.deleteMany({
      where: { congregationId: id },
    });

    // 6. Remove push subscriptions de membros (já desvinculados, mas limpeza de dados)
    // Não removemos — pertencem ao usuário, não à congregação.

    // 7. Exclui a congregação
    await tx.congregation.delete({ where: { id } });
  });

  return NextResponse.json({
    ok: true,
    message: `Congregação "${congregation.name}" excluída com sucesso.`,
    membersUnlinked: congregation._count.members,
    territoriesRemoved: congregation._count.territories,
  });
}
