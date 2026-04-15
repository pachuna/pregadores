import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTerritoryManager } from "@/lib/auth-middleware";
import { notifyByCongregation } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/territories/[id]/share
 * Compartilha o território com todos os membros da congregação via push notification.
 * Requer ADMIN, ANCIAO ou SERVO_DE_CAMPO.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Busca o território com a congregação
  const territory = await prisma.territory.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      label: true,
      imageUrl: true,
      lastSharedAt: true,
      congregationId: true,
      congregation: { select: { name: true, state: true } },
    },
  });

  if (!territory) {
    return NextResponse.json({ error: "Território não encontrado" }, { status: 404 });
  }

  if (!territory.congregationId) {
    return NextResponse.json({ error: "Território sem congregação vinculada" }, { status: 400 });
  }

  // Verifica se o usuário pertence à mesma congregação (salvo ADMIN global)
  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (user?.congregationId !== territory.congregationId) {
      return NextResponse.json(
        { error: "Você só pode compartilhar territórios da sua congregação." },
        { status: 403 }
      );
    }
  }

  // Determina última data trabalhada via query direta (mais eficiente)
  const lastVisit = await prisma.houseVisit.findFirst({
    where: { house: { street: { territoryId: id } } },
    orderBy: { visitedAt: "desc" },
    select: { visitedAt: true },
  });

  const lastWorkedAt = lastVisit?.visitedAt ?? null;

  const lastWorkedLabel = lastWorkedAt
    ? `Último trabalho: ${lastWorkedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`
    : "Nunca trabalhado";

  const name = territory.label ?? `Território ${territory.number}`;
  const url = `/congregations/territories/${territory.id}`;
  const congregation = territory.congregation;

  // Atualiza lastSharedAt
  await prisma.territory.update({
    where: { id },
    data: { lastSharedAt: new Date() },
  });

  // Dispara push para todos os membros da congregação
  await notifyByCongregation(territory.congregationId, {
    title: `📍 ${name} disponível para trabalho`,
    body: `${congregation ? `${congregation.name} · ${congregation.state}` : ""}\n${lastWorkedLabel}`,
    url,
  });

  return NextResponse.json({
    ok: true,
    lastSharedAt: new Date().toISOString(),
    lastWorkedAt: lastWorkedAt?.toISOString() ?? null,
  });
  } catch (err) {
    console.error("[share] erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
