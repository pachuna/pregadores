import { NextRequest, NextResponse } from "next/server";

export const revalidate = 86400;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uf: string }> },
) {
  const { uf } = await params;
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar cidades." }, { status: 502 });
  }
}
