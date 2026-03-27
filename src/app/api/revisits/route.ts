import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const revisits = await prisma.revisit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(revisits);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  try {
    const body = await request.json();
    const { name, address, latitude, longitude, notes, visitDate } = body;

    if (!name || !address || latitude == null || longitude == null || !visitDate) {
      return NextResponse.json(
        { error: "Campos obrigatórios: name, address, latitude, longitude, visitDate" },
        { status: 400 }
      );
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { error: "latitude e longitude devem ser números" },
        { status: 400 }
      );
    }

    const revisit = await prisma.revisit.create({
      data: {
        userId,
        name: String(name),
        address: String(address),
        latitude,
        longitude,
        notes: notes ? String(notes) : null,
        visitDate: new Date(visitDate),
      },
    });

    return NextResponse.json(revisit, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
