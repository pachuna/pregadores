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
  email_verified?: string | boolean;
}

function getAllowedGoogleClientIds() {
  const fromServer = (process.env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const fromPublic = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const unique = Array.from(new Set([...fromServer, ...fromPublic]));
  if (unique.length === 0) {
    throw new Error("GOOGLE_CLIENT_ID não configurado no servidor");
  }

  return unique;
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

    const allowedClientIds = getAllowedGoogleClientIds();
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
    const emailVerified =
      tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

    if (!tokenInfo.aud || !allowedClientIds.includes(tokenInfo.aud) || !emailVerified) {
      console.error("Google token recusado", {
        aud: tokenInfo.aud,
        emailVerified: tokenInfo.email_verified,
      });
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
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: ADMIN_EMAIL && email === ADMIN_EMAIL ? "ADMIN" : "PUBLICADOR",
        },
      });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "Conta bloqueada. Entre em contato com o administrador." },
        { status: 403 },
      );
    }

    const tokens = await generateTokenPair(user.id, user.role);
    return NextResponse.json({ ...tokens, role: user.role });
  } catch (error) {
    console.error("Erro no auth Google:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
