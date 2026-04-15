import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTerritoryManager } from "@/lib/auth-middleware";

async function checkAccess(
  auth: { userId: string; role: string },
  territoryId: string,
  streetId: string,
  houseId: string
): Promise<{ error: string; status: number } | null> {
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    include: {
      street: {
        include: { territory: { select: { id: true, congregationId: true } } },
      },
    },
  });

  if (!house || house.streetId !== streetId || house.street.territoryId !== territoryId) {
    return { error: "Casa não encontrada.", status: 404 };
  }

  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (house.street.territory.congregationId !== user?.congregationId) {
      return { error: "Acesso negado.", status: 403 };
    }
  }

  return null;
}

/**
 * PATCH /api/territories/[id]/streets/[streetId]/houses/[houseId]
 * Atualiza número e/ou observação de uma casa.
 * Body: { number?: string; observation?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; streetId: string; houseId: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id, streetId, houseId } = await params;

  const denied = await checkAccess(auth, id, streetId, houseId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  let body: { number?: string; observation?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const number = body.number?.trim();

  if (number !== undefined && !number) {
    return NextResponse.json({ error: "O número da casa é obrigatório." }, { status: 400 });
  }

  // Verifica duplicata (exceto a própria casa)
  if (number) {
    const existing = await prisma.house.findFirst({
      where: { streetId, number: { equals: number, mode: "insensitive" }, NOT: { id: houseId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `O número "${number}" já existe nesta rua.` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.house.update({
    where: { id: houseId },
    data: {
      ...(number ? { number } : {}),
      ...(body.observation !== undefined ? { observation: body.observation?.trim() || null } : {}),
    },
    select: { id: true, number: true, observation: true },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/territories/[id]/streets/[streetId]/houses/[houseId]
 * Remove uma casa da rua.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; streetId: string; houseId: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id, streetId, houseId } = await params;

  const denied = await checkAccess(auth, id, streetId, houseId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  await prisma.house.delete({ where: { id: houseId } });

  return NextResponse.json({ ok: true });
}
