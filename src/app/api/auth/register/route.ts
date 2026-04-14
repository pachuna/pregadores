import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateTokenPair } from "@/lib/jwt";

const SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const email = rawEmail.trim().toLowerCase();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter no mínimo 6 caracteres" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, SALT_ROUNDS);

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: ADMIN_EMAIL && email === ADMIN_EMAIL ? "ADMIN" : "PUBLICADOR",
      },
    });

    const tokens = await generateTokenPair(user.id, user.role);
    return NextResponse.json({ ...tokens, role: user.role, congregationId: user.congregationId ?? null, name: user.name ?? null }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
