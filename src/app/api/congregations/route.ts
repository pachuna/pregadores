import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";
import { notifyByRole } from "@/lib/push";

/**
 * GET /api/congregations
 * - ADMIN: retorna todas
 * - ANCIAO/PUBLICADOR: retorna apenas a própria congregação (se vinculado)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role === "ADMIN") {
    const congregations = await prisma.congregation.findMany({
      include: {
        _count: { select: { members: true } },
        createdBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(congregations);
  }

  // Ancião ou Publicador: só a própria
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      congregation: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  // Se já é membro de uma congregação, retorna ela
  if (user?.congregation) {
    return NextResponse.json(user.congregation);
  }

  // Se não é membro, verifica se criou uma congregação em análise ou recusada
  const created = await prisma.congregation.findFirst({
    where: {
      createdById: auth.userId,
      status: { in: ["PENDING", "REJECTED"] },
    },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(created ?? null);
}

/**
 * POST /api/congregations
 * Qualquer Ancião sem congregação pode solicitar.
 * Body: { name, jwEmail, state, city }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== "ANCIAO" && auth.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Somente Anciãos podem solicitar cadastro de congregação." },
      { status: 403 }
    );
  }

  // Ancião já vinculado não pode solicitar outra
  if (auth.role === "ANCIAO") {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { congregationId: true },
    });
    if (user?.congregationId) {
      return NextResponse.json(
        { error: "Você já está vinculado a uma congregação." },
        { status: 409 }
      );
    }
  }

  let body: { name?: string; jwEmail?: string; state?: string; city?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  const jwEmail = body.jwEmail?.trim().toLowerCase();
  const state = body.state?.trim().toUpperCase();
  const city = body.city?.trim();

  if (!name || !jwEmail || !state || !city) {
    return NextResponse.json(
      { error: "name, jwEmail, state e city são obrigatórios" },
      { status: 400 }
    );
  }

  // Validação básica de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(jwEmail)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  // Verifica duplicata por nome+estado+cidade
  const existing = await prisma.congregation.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      state,
      city: { equals: city, mode: "insensitive" },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma congregação com esse nome nessa cidade." },
      { status: 409 }
    );
  }

  // ADMIN cria direto como ACTIVE; Ancião cria como PENDING (aguarda aprovação)
  const status = auth.role === "ADMIN" ? "ACTIVE" : "PENDING";

  const congregation = await prisma.congregation.create({
    data: { name, jwEmail, state, city, createdById: auth.userId, status },
  });

  // Notifica ADMINs somente quando criado por Ancião (PENDING)
  if (auth.role !== "ADMIN") {
    await notifyByRole("ADMIN", {
      title: "Nova solicitação de congregação",
      body: `${name} (${city}/${state}) aguarda aprovação.`,
      url: "/admin/congregations",
    }).catch(() => {});
  }

  return NextResponse.json(congregation, { status: 201 });
}
