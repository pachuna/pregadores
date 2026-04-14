import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import { Role } from "@/generated/prisma/enums";

const VALID_ROLES: Role[] = ["ADMIN", "ANCIAO", "PUBLICADOR", "SERVO_DE_CAMPO"];

/**
 * PATCH /api/admin/users/[id] — Edita dados de um usuário (admins only)
 * Body: { role?, congregation?, isBlocked? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const updateData: {
    role?: Role;
    congregationId?: string | null;
    isBlocked?: boolean;
  } = {};

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as Role)) {
      return NextResponse.json(
        { error: `role deve ser um de: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }
    updateData.role = body.role as Role;
  }

  if (body.congregationId !== undefined) {
    updateData.congregationId =
      body.congregationId === null || body.congregationId === ""
        ? null
        : String(body.congregationId).trim();
  }

  if (body.isBlocked !== undefined) {
    if (typeof body.isBlocked !== "boolean") {
      return NextResponse.json(
        { error: "isBlocked deve ser boolean" },
        { status: 400 }
      );
    }
    updateData.isBlocked = body.isBlocked;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Nenhuma alteração informada" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      role: true,
      congregationId: true,
      isBlocked: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/admin/users/[id] — Remove um usuário e todas as suas revisitas (admins only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Impede que o admin se auto-exclua
  if (auth.userId === id) {
    return NextResponse.json(
      { error: "Não é possível excluir a própria conta pelo painel de admin." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
