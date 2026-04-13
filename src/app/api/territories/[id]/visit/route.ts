import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

/**
 * POST /api/territories/[id]/visit
 * Marca a visita de uma casa com status OK (Atendeu) ou FAIL (Pediu para não bater).
 *
 * Body: { houseId: string, status: "OK" | "FAIL" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: territoryId } = await params;
  const body = await request.json();
  const { houseId, status } = body as { houseId?: string; status?: string };

  if (!houseId || !status) {
    return NextResponse.json(
      { error: "houseId e status são obrigatórios." },
      { status: 400 }
    );
  }

  if (status !== "OK" && status !== "FAIL") {
    return NextResponse.json(
      { error: "status deve ser 'OK' ou 'FAIL'." },
      { status: 400 }
    );
  }

  // Valida que a casa pertence ao território e à congregação do usuário
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    include: {
      street: {
        include: {
          territory: {
            select: { id: true, congregationId: true },
          },
        },
      },
    },
  });

  if (!house || house.street.territory.id !== territoryId) {
    return NextResponse.json(
      { error: "Casa não encontrada neste território." },
      { status: 404 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  if (
    house.street.territory.congregationId !== user?.congregationId &&
    auth.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Cria o registro de visita
  const visit = await prisma.houseVisit.create({
    data: {
      houseId,
      status: status as "OK" | "FAIL",
      visitedAt: new Date(),
      userId: auth.userId,
    },
    select: {
      id: true,
      status: true,
      visitedAt: true,
    },
  });

  // Atualiza lastUpdate do território
  await prisma.territory.update({
    where: { id: territoryId },
    data: { lastUpdate: new Date() },
  });

  return NextResponse.json(visit, { status: 201 });
}
