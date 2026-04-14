import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

export interface ViaCEPStreet {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/**
 * GET /api/territories/street-search?q=rua+das+flores
 * Busca ruas via ViaCEP usando o estado e cidade da congregação do usuário.
 * Retorna até 50 resultados.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 3) {
    return NextResponse.json(
      { error: "Digite pelo menos 3 caracteres para buscar." },
      { status: 400 }
    );
  }

  // Busca congregação do usuário para obter UF e cidade
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      congregation: {
        select: { state: true, city: true },
      },
    },
  });

  const uf = user?.congregation?.state;
  const city = user?.congregation?.city;

  if (!uf || !city) {
    return NextResponse.json(
      { error: "Usuário não vinculado a uma congregação com estado/cidade definidos." },
      { status: 403 }
    );
  }

  // ViaCEP: GET /ws/{UF}/{City}/{Street}/json/
  const viaCepUrl = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(q)}/json/`;

  try {
    const res = await fetch(viaCepUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();

    // ViaCEP retorna objeto com "erro" se não encontrar
    if (!Array.isArray(data)) {
      return NextResponse.json({ results: [] });
    }

    const results: ViaCEPStreet[] = data.slice(0, 50).map((item: ViaCEPStreet) => ({
      cep: item.cep,
      logradouro: item.logradouro,
      bairro: item.bairro,
      localidade: item.localidade,
      uf: item.uf,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
