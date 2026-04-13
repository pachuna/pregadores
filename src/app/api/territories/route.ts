import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

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
