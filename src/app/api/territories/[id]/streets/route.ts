import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireTerritoryManager } from "@/lib/auth-middleware";

/**
 * POST /api/territories/[id]/streets
 * Adiciona uma rua ao território.
 * Body: { name: string; houses?: string[] }
 * Restrito a ADMIN, ANCIAO e SERVO_DE_CAMPO.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  const territory = await prisma.territory.findUnique({
    where: { id },
    select: { id: true, congregationId: true },
  });

  if (!territory) {
    return NextResponse.json({ error: "Território não encontrado." }, { status: 404 });
  }

  if (territory.congregationId !== user?.congregationId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: { name?: string; houses?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "O nome da rua é obrigatório." }, { status: 400 });
  }

  const streetId = randomUUID();
  const housesData = (body.houses ?? [])
    .map((h) => String(h).trim())
    .filter((h) => h.length > 0)
    .map((number) => ({ id: randomUUID(), number }));

  const street = await prisma.street.create({
    data: {
      id: streetId,
      name,
      territoryId: id,
      houses: {
        create: housesData,
      },
    },
    include: {
      houses: {
        orderBy: { number: "asc" },
      },
    },
  });

  return NextResponse.json(street, { status: 201 });
}

/**
 * DELETE /api/territories/[id]/streets?streetId=xxx
 * Remove uma rua do território.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const streetId = searchParams.get("streetId");

  if (!streetId) {
    return NextResponse.json({ error: "streetId é obrigatório." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  const street = await prisma.street.findUnique({
    where: { id: streetId },
    include: { territory: { select: { congregationId: true } } },
  });

  if (!street || street.territoryId !== id) {
    return NextResponse.json({ error: "Rua não encontrada." }, { status: 404 });
  }

  if (street.territory.congregationId !== user?.congregationId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  await prisma.street.delete({ where: { id: streetId } });

  return NextResponse.json({ ok: true });
}
