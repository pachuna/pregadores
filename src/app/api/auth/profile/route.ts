import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, isAuthError } from "@/lib/auth-middleware";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Nome deve ter pelo menos 2 caracteres" },
        { status: 400 },
      );
    }

    if (name.length > 60) {
      return NextResponse.json(
        { error: "Nome muito longo (máximo 60 caracteres)" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: { name },
    });

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error("Erro em PATCH /api/auth/profile:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
