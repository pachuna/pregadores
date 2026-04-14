import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";
import { notifyUser } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/congregations/[id]/members
 * Vincula um usuário à congregação.
 * - ADMIN: pode vincular qualquer usuário e definir/promover como ANCIAO.
 * - ANCIAO da congregação: pode vincular Publicadores e novos Anciãos.
 *
 * Body: { userId, role? }
 *   role: se ADMIN enviar "ANCIAO" -> promove o usuário e vincula como primeiro ancião.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId } = await params;

  // Verifica permissão: ADMIN ou Ancião da congregação
  const isAdmin = auth.role === "ADMIN";
  if (!isAdmin) {
    if (auth.role !== "ANCIAO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (requester?.congregationId !== congregationId) {
      return NextResponse.json(
        { error: "Você só pode gerenciar membros da sua congregação." },
        { status: 403 }
      );
    }
  }

  const congregation = await prisma.congregation.findUnique({
    where: { id: congregationId },
  });
  if (!congregation) {
    return NextResponse.json({ error: "Congregação não encontrada" }, { status: 404 });
  }
  if (congregation.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Só é possível vincular membros a congregações ativas." },
      { status: 400 }
    );
  }

  let body: { userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { userId, role: newRole } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
  }

  // Somente ADMIN pode promover para ANCIAO
  if (newRole === "ANCIAO" && !isAdmin) {
    return NextResponse.json(
      { error: "Somente o Admin pode promover um Ancião." },
      { status: 403 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const updateData: { congregationId: string; role?: "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO" } = {
    congregationId,
  };
  if (newRole === "ANCIAO") updateData.role = "ANCIAO";
  if (newRole === "PUBLICADOR") updateData.role = "PUBLICADOR";
  if (newRole === "SERVO_DE_CAMPO") updateData.role = "SERVO_DE_CAMPO";

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, role: true, congregationId: true },
  });

  // Notifica o usuário vinculado
  await notifyUser(userId, {
    title: "Você foi vinculado a uma congregação",
    body: `Bem-vindo à ${congregation.name}!`,
    url: "/congregations",
  }).catch(() => {});

  return NextResponse.json(updated);
}

/**
 * PATCH /api/congregations/[id]/members
 * Atualiza role ou isBlocked de um membro.
 * - ADMIN: qualquer congregação.
 * - ANCIAO: somente sua congregação; pode bloquear/desbloquear publicadores
 *   e promover/rebaixar outros Anciãos.
 *
 * Body: { userId, isBlocked?, role? }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId } = await params;

  const isAdmin = auth.role === "ADMIN";
  if (!isAdmin) {
    if (auth.role !== "ANCIAO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (requester?.congregationId !== congregationId) {
      return NextResponse.json(
        { error: "Você só pode gerenciar membros da sua congregação." },
        { status: 403 }
      );
    }
  }

  let body: { userId?: string; isBlocked?: boolean; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { userId, isBlocked, role: newRole } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
  }

  // Ancião não pode alterar o próprio perfil via este endpoint
  if (!isAdmin && userId === auth.userId) {
    return NextResponse.json(
      { error: "Você não pode alterar seu próprio perfil por aqui." },
      { status: 400 }
    );
  }

  // Somente ADMIN pode promover para ANCIAO
  if (newRole === "ANCIAO" && !isAdmin) {
    return NextResponse.json(
      { error: "Somente o Admin pode promover um Ancião." },
      { status: 403 }
    );
  }

  const updateData: { isBlocked?: boolean; role?: "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO" } = {};
  if (typeof isBlocked === "boolean") updateData.isBlocked = isBlocked;
  if (newRole === "ANCIAO") updateData.role = "ANCIAO";
  if (newRole === "PUBLICADOR") updateData.role = "PUBLICADOR";
  if (newRole === "SERVO_DE_CAMPO") updateData.role = "SERVO_DE_CAMPO";

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração informada" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, congregationId },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Usuário não é membro desta congregação" },
      { status: 404 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, role: true, isBlocked: true },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/congregations/[id]/members
 * Desvincula um usuário da congregação.
 * - ADMIN: qualquer congregação.
 * - ANCIAO: somente sua congregação (não pode remover outros Anciãos).
 *
 * Body: { userId }
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId } = await params;

  const isAdmin = auth.role === "ADMIN";
  if (!isAdmin) {
    if (auth.role !== "ANCIAO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (requester?.congregationId !== congregationId) {
      return NextResponse.json(
        { error: "Você só pode gerenciar membros da sua congregação." },
        { status: 403 }
      );
    }
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: body.userId, congregationId },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Usuário não é membro desta congregação" },
      { status: 404 }
    );
  }

  // Ancião não pode remover outros Anciãos
  if (!isAdmin && target.role === "ANCIAO") {
    return NextResponse.json(
      { error: "Somente o Admin pode remover um Ancião." },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: body.userId },
    data: { congregationId: null },
  });

  return new NextResponse(null, { status: 204 });
}
