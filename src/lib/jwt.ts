import { SignJWT, jwtVerify } from "jose";

function getSecretFromEnv(name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} não definido em ambiente de produção`);
  }

  return name === "JWT_SECRET"
    ? "fallback-dev-secret"
    : "fallback-refresh-secret";
}

const JWT_SECRET = new TextEncoder().encode(getSecretFromEnv("JWT_SECRET"));
const JWT_REFRESH_SECRET = new TextEncoder().encode(
  getSecretFromEnv("JWT_REFRESH_SECRET")
);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export async function signAccessToken(
  userId: string,
  role: string
): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(
  token: string
): Promise<{ sub: string; role?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; role?: string };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as { sub: string };
  } catch {
    return null;
  }
}

export async function generateTokenPair(userId: string, role: string) {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId, role),
    signRefreshToken(userId),
  ]);
  return { accessToken, refreshToken };
}
