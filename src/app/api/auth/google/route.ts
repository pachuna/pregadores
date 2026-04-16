import { randomUUID } from "node:crypto";
import { request as httpsRequest } from "node:https";
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

/**
 * Faz GET com o mÃ³dulo `https` do Node (nÃ£o undici/fetch).
 * O mÃ³dulo nativo respeita --dns-result-order=ipv4first, corrigindo
 * ETIMEDOUT em servidores sem conectividade IPv6 real.
 */
function httpsGet<T>(url: string): Promise<{ ok: boolean; status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: "GET", family: 4 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, data: JSON.parse(body) as T });
        } catch {
          reject(new Error(`JSON invÃ¡lido: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(new Error("timeout")); });
    req.end();
  });
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
    throw new Error("GOOGLE_CLIENT_ID nÃ£o configurado no servidor");
  }

  return unique;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body?.idToken as string | undefined;

    if (!idToken) {
      return NextResponse.json(
        { error: "Token Google Ã© obrigatÃ³rio" },
        { status: 400 },
      );
    }

    const allowedClientIds = getAllowedGoogleClientIds();

    const tokenInfoResponse = await httpsGet<GoogleTokenInfo>(
      `${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!tokenInfoResponse.ok) {
      console.error("Google tokeninfo rejeitou o token", {
        status: tokenInfoResponse.status,
        data: tokenInfoResponse.data,
      });
      return NextResponse.json(
        { error: "Token Google invÃ¡lido" },
        { status: 401 },
      );
    }

    const tokenInfo = tokenInfoResponse.data;
    const emailVerified =
      tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

    if (!tokenInfo.aud || !allowedClientIds.includes(tokenInfo.aud) || !emailVerified) {
      console.error("Google token recusado", {
        aud: tokenInfo.aud,
        allowedClientIds,
        emailVerified: tokenInfo.email_verified,
        email: tokenInfo.email,
      });
      return NextResponse.json(
        { error: "Token Google invÃ¡lido" },
        { status: 401 },
      );
    }

    const email = tokenInfo.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Email Google nÃ£o disponÃ­vel" },
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
          role: "PUBLICADOR",
        },
      });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "Conta bloqueada. Entre em contato com o administrador." },
        { status: 403 },
      );
    }

    const tokens = await generateTokenPair(
      user.id,
      user.role,
      user.refreshTokenVersion
    );
    return NextResponse.json({ ...tokens, role: user.role, congregationId: user.congregationId ?? null, name: user.name ?? null });
  } catch (error) {
    console.error("Erro no auth Google:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}