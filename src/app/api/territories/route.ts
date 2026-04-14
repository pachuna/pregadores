import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, requireTerritoryManager } from "@/lib/auth-middleware";

/**
 * GET /api/territories
 * Retorna a lista de territórios da congregação do usuário autenticado.
 * Inclui o total de casas e quantas foram visitadas (OK ou FAIL) na última visita.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  // Busca congregação do usuário
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  if (!user?.congregationId) {
    return NextResponse.json(
      { error: "Usuário não vinculado a nenhuma congregação." },
      { status: 403 }
    );
  }

  const territories = await prisma.territory.findMany({
    where: { congregationId: user.congregationId },
    orderBy: { number: "asc" },
    include: {
      _count: { select: { streets: true } },
      streets: {
        include: {
          _count: { select: { houses: true } },
        },
      },
    },
  });

  // Para cada território, contar o total de casas e últimas visitas
  const result = await Promise.all(
    territories.map(async (t) => {
      const totalHouses = t.streets.reduce(
        (acc, s) => acc + s._count.houses,
        0
      );

      // Última visita registrada em qualquer casa desse território
      const lastVisit = await prisma.houseVisit.findFirst({
        where: {
          house: { street: { territoryId: t.id } },
        },
        orderBy: { visitedAt: "desc" },
        select: { visitedAt: true },
      });

      return {
        id: t.id,
        number: t.number,
        label: t.label,
        territoryType: t.territoryType,
        imageUrl: t.imageUrl,
        color: t.color,
        hidden: t.hidden,
        lastUpdate: t.lastUpdate,
        totalStreets: t._count.streets,
        totalHouses,
        lastVisitAt: lastVisit?.visitedAt ?? null,
      };
    })
  );

  return NextResponse.json(result);
}

/**
 * POST /api/territories
 * Cria um novo território manual. Restrito a ADMIN, ANCIAO e SERVO_DE_CAMPO.
 * Body: { label: string; color?: string; territoryType: "IMAGE" | "STREETS" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  if (!user?.congregationId) {
    return NextResponse.json(
      { error: "Usuário não vinculado a nenhuma congregação." },
      { status: 403 }
    );
  }

  let body: { label?: string; color?: string; territoryType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const label = (body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "O rótulo do território é obrigatório." }, { status: 400 });
  }

  const territoryType = body.territoryType === "IMAGE" ? "IMAGE" : "STREETS";
  const color = (body.color ?? "#4a6da7").trim();

  // Auto-incrementa number baseado no maior existente
  const max = await prisma.territory.aggregate({ _max: { number: true } });
  const nextNumber = (max._max.number ?? 0) + 1;

  const territory = await prisma.territory.create({
    data: {
      number: nextNumber,
      label,
      color,
      territoryType,
      congregationId: user.congregationId,
    },
  });

  return NextResponse.json({
    id: territory.id,
    number: territory.number,
    label: territory.label,
    territoryType: territory.territoryType,
    imageUrl: territory.imageUrl,
    color: territory.color,
    hidden: territory.hidden,
  }, { status: 201 });
}
