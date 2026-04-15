import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";
import { notifyUser } from "@/lib/push";

/**
 * GET /api/congregations/[id]/join
 * Retorna pedidos de entrada PENDENTES desta congregação.
 * Requer: ANCIÃO da congregação ou ADMIN.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId } = await params;

  // Verifica permissão: ADMIN ou ANCIÃO desta congregação
  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true, role: true },
    });
    if (
      user?.congregationId !== congregationId ||
      (user?.role !== "ANCIAO" && user?.role !== "SERVO_DE_CAMPO")
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  }

  const requests = await prisma.congregationJoinRequest.findMany({
    where: { congregationId, status: "PENDING" },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(requests);
}

/**
 * POST /api/congregations/[id]/join
 * Usuário solicita entrar nesta congregação.
 * Requer: usuário autenticado, com nome, sem congregação e sem pedido ativo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { id: congregationId } = await params;

  // Busca nome e congregação atual do usuário
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true, congregationId: true },
  });

  // Usuário não pode pedir entrada se já tem congregação
  if (user?.congregationId) {
    return NextResponse.json(
      { error: "Você já está vinculado a uma congregação." },
      { status: 409 }
    );
  }

  if (!user?.name) {
    return NextResponse.json(
      { error: "Você precisa definir seu nome antes de solicitar entrada." },
      { status: 400 }
    );
  }

  // Verifica se a congregação existe e está ATIVA
  const congregation = await prisma.congregation.findUnique({
    where: { id: congregationId },
    select: { id: true, name: true, status: true },
  });
  if (!congregation || congregation.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Congregação não encontrada ou inativa." },
      { status: 404 }
    );
  }

  // Verifica se já existe pedido PENDENTE para qualquer congregação
  const existingPending = await prisma.congregationJoinRequest.findFirst({
    where: { userId: auth.userId, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Você já tem um pedido de entrada pendente." },
      { status: 409 }
    );
  }

  // Cria ou reutiliza pedido (upsert: pode existir REJECTED anterior para esta congregação)
  const joinRequest = await prisma.congregationJoinRequest.upsert({
    where: { userId_congregationId: { userId: auth.userId, congregationId } },
    create: { userId: auth.userId, congregationId, status: "PENDING" },
    update: { status: "PENDING", rejectionReason: null },
  });

  // Notifica ANCIÃO e SERVO_DE_CAMPO desta congregação + todos os ADMINs
  try {
    const [leaders, admins] = await Promise.all([
      prisma.user.findMany({
        where: { congregationId, role: { in: ["ANCIAO", "SERVO_DE_CAMPO"] } },
        select: { id: true },
      }),
      prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      }),
    ]);
    const targets = [...new Map([...leaders, ...admins].map((u) => [u.id, u])).values()];
    await Promise.allSettled(
      targets.map((l) =>
        notifyUser(l.id, {
          title: "Nova solicitação de entrada",
          body: `${user.name} quer entrar na congregação ${congregation.name}.`,
          url: "/congregations",
        })
      )
    );
  } catch {
    // notificação não é crítica
  }

  return NextResponse.json(joinRequest, { status: 201 });
}
