import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

/**
 * GET /api/congregations/active
 * Retorna todas as congregações ATIVAS para o seletor de entrada.
 * Também retorna o pedido de entrada pendente do usuário (se houver).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const [congregations, pendingRequest] = await Promise.all([
    prisma.congregation.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, city: true, state: true },
      orderBy: [{ state: "asc" }, { city: "asc" }, { name: "asc" }],
    }),
    prisma.congregationJoinRequest.findFirst({
      where: { userId: auth.userId, status: "PENDING" },
      include: {
        congregation: { select: { id: true, name: true, city: true, state: true } },
      },
    }),
  ]);

  return NextResponse.json({
    congregations,
    pendingRequest: pendingRequest
      ? {
          id: pendingRequest.id,
          congregationId: pendingRequest.congregationId,
          congregationName: pendingRequest.congregation.name,
          congregationCity: pendingRequest.congregation.city,
          congregationState: pendingRequest.congregation.state,
          status: pendingRequest.status,
          createdAt: pendingRequest.createdAt,
        }
      : null,
  });
}
