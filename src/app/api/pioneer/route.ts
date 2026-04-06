import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/pioneer?year=2026&month=4
 * Retorna todos os registros do mês para o usuário autenticado.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const reports = await prisma.pioneerReport.findMany({
    where: { userId: auth.userId, date: { startsWith: prefix } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(reports);
}

/**
 * POST /api/pioneer
 * Upsert de um registro diário (cria ou atualiza pelo dia).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    date?: string;
    hours?: number;
    minutes?: number;
    creditHours?: number;
    bibleStudies?: number;
    goalHours?: number;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    date,
    hours = 0,
    minutes = 0,
    creditHours = 0,
    bibleStudies = 0,
    goalHours = 4,
    notes,
  } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data inválida (esperado YYYY-MM-DD)" }, { status: 400 });
  }

  const data = {
    hours: Math.max(0, Math.min(23, Math.floor(hours))),
    minutes: Math.max(0, Math.min(59, Math.floor(minutes))),
    creditHours: Math.max(0, Math.floor(creditHours)),
    bibleStudies: Math.max(0, Math.floor(bibleStudies)),
    goalHours: Math.max(0, Math.floor(goalHours)),
    notes: notes?.trim() || null,
    updatedAt: new Date(),
  };

  const report = await prisma.pioneerReport.upsert({
    where: { userId_date: { userId: auth.userId, date } },
    create: { userId: auth.userId, date, ...data },
    update: data,
  });

  return NextResponse.json(report);
}
