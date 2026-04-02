import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateTokenPair } from "@/lib/jwt";

const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const SALT_ROUNDS = 12;

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string;
}

function getGoogleClientId() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado");
  }

  return clientId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body?.idToken as string | undefined;

    if (!idToken) {
      return NextResponse.json(
        { error: "Token Google é obrigatório" },
        { status: 400 },
      );
    }

    const clientId = getGoogleClientId();
    const tokenInfoResponse = await fetch(
      `${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`,
      { cache: "no-store" },
    );

    if (!tokenInfoResponse.ok) {
      return NextResponse.json(
        { error: "Token Google inválido" },
        { status: 401 },
      );
    }

    const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfo;

    if (tokenInfo.aud !== clientId || tokenInfo.email_verified !== "true") {
      return NextResponse.json(
        { error: "Token Google inválido" },
        { status: 401 },
      );
    }

    const email = tokenInfo.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Email Google não disponível" },
        { status: 400 },
      );
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const passwordHash = await hash(`google:${randomUUID()}`, SALT_ROUNDS);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      });
    }

    const tokens = await generateTokenPair(user.id);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Erro no auth Google:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
