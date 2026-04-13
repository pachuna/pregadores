import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

/**
 * GET /api/territories/[id]
 * Retorna o território com todas as ruas e casas (+ última visita de cada casa).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  const territory = await prisma.territory.findUnique({
    where: { id },
    include: {
      streets: {
        orderBy: { name: "asc" },
        include: {
          houses: {
            orderBy: { number: "asc" },
            include: {
              visits: {
                orderBy: { visitedAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  visitedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!territory) {
    return NextResponse.json({ error: "Território não encontrado." }, { status: 404 });
  }

  // Garante que o território pertence à congregação do usuário
  if (territory.congregationId !== user?.congregationId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Formata a resposta
  const formatted = {
    id: territory.id,
    number: territory.number,
    color: territory.color,
    hidden: territory.hidden,
    lastUpdate: territory.lastUpdate,
    streets: territory.streets.map((street) => ({
      id: street.id,
      name: street.name,
      lastUpdate: street.lastUpdate,
      houses: street.houses.map((house) => ({
        id: house.id,
        number: house.number,
        observation: house.observation,
        lastVisit: house.visits[0]
          ? {
              id: house.visits[0].id,
              status: house.visits[0].status,
              visitedAt: house.visits[0].visitedAt,
            }
          : null,
      })),
    })),
  };

  return NextResponse.json(formatted);
}
