import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, requireTerritoryManager } from "@/lib/auth-middleware";

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
    label: territory.label,
    territoryType: territory.territoryType,
    imageUrl: territory.imageUrl,
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

/**
 * DELETE /api/territories/[id]
 * Remove o território e todos os dados associados (ruas, casas, visitas).
 * Apaga também o arquivo de imagem gerado, se existir.
 */
export async function DELETE(
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
    select: { id: true, congregationId: true, imageUrl: true },
  });

  if (!territory) {
    return NextResponse.json({ error: "Território não encontrado." }, { status: 404 });
  }

  if (territory.congregationId !== user?.congregationId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Remove em cascata via Prisma (dependências: visitas → casas → ruas → território)
  await prisma.territory.delete({ where: { id } });

  // Apaga arquivo de imagem gerado, se existir
  if (territory.imageUrl) {
    try {
      const filePath = path.join(process.cwd(), "public", territory.imageUrl);
      await unlink(filePath);
    } catch {
      // Ignora se o arquivo já não existir
    }
  }

  return NextResponse.json({ ok: true });
}
