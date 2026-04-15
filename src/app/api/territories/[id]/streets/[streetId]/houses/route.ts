import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireTerritoryManager } from "@/lib/auth-middleware";

async function checkAccess(
  auth: { userId: string; role: string },
  territoryId: string,
  streetId: string
): Promise<{ error: string; status: number } | null> {
  const street = await prisma.street.findUnique({
    where: { id: streetId },
    include: { territory: { select: { id: true, congregationId: true } } },
  });

  if (!street || street.territoryId !== territoryId) {
    return { error: "Rua não encontrada.", status: 404 };
  }

  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (street.territory.congregationId !== user?.congregationId) {
      return { error: "Acesso negado.", status: 403 };
    }
  }

  return null;
}

/**
 * GET /api/territories/[id]/streets/[streetId]/houses
 * Lista as casas de uma rua.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; streetId: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id, streetId } = await params;

  const denied = await checkAccess(auth, id, streetId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const houses = await prisma.house.findMany({
    where: { streetId },
    select: { id: true, number: true, observation: true },
    orderBy: { number: "asc" },
  });

  return NextResponse.json(houses);
}

/**
 * POST /api/territories/[id]/streets/[streetId]/houses
 * Adiciona uma casa à rua.
 * Body: { number: string; observation?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; streetId: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id, streetId } = await params;

  const denied = await checkAccess(auth, id, streetId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  let body: { number?: string; observation?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const number = (body.number ?? "").trim();
  if (!number) {
    return NextResponse.json({ error: "O número da casa é obrigatório." }, { status: 400 });
  }

  // Verifica duplicata na mesma rua
  const existing = await prisma.house.findFirst({
    where: { streetId, number: { equals: number, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `O número "${number}" já existe nesta rua.` },
      { status: 409 }
    );
  }

  const house = await prisma.house.create({
    data: {
      id: randomUUID(),
      number,
      observation: body.observation?.trim() || null,
      streetId,
    },
    select: { id: true, number: true, observation: true },
  });

  return NextResponse.json(house, { status: 201 });
}
