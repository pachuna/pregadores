import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";

/**
 * Extrai e valida o userId do Bearer token.
 * Retorna o userId ou uma Response 401.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<string | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Token não fornecido" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);

  if (!payload?.sub) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }

  return payload.sub;
}
