import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";

export interface AuthPayload {
  userId: string;
  role: string;
}

/**
 * Extrai e valida o userId e role do Bearer token.
 * Retorna AuthPayload ou uma Response 401/403.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthPayload | NextResponse> {
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

  return { userId: payload.sub, role: payload.role ?? "PUBLICADOR" };
}

/**
 * Verifica se o resultado de authenticateRequest é um erro (NextResponse).
 */
export function isAuthError(
  result: AuthPayload | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Exige que o usuário autenticado seja ADMIN.
 * Retorna AuthPayload ou NextResponse 401/403.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthPayload | NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso negado. Requer perfil de administrador." },
      { status: 403 }
    );
  }

  return auth;
}
