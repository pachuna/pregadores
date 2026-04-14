"use client";

import { useCallback, useState } from "react";
import { territoriesApi } from "@/lib/api";

interface StreetResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

interface StreetItem {
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EditTerritoryModal({
  territoryId,
  initialStreets,
  onClose,
  onUpdated,
}: {
  territoryId: string;
  initialStreets: StreetItem[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [streets, setStreets] = useState<StreetItem[]>(initialStreets);

  // Adicionar rua
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StreetResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [debounce, setDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Remover
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Gerar mapa
  const [mapLoading, setMapLoading] = useState(false);
  const [mapSuccess, setMapSuccess] = useState(false);
  const [mapError, setMapError] = useState("");

  const [error, setError] = useState("");

  // ── Busca de rua ────────────────────────────────────────────────────────

  function handleQueryChange(q: string) {
    setQuery(q);
    setResults([]);
    if (debounce) clearTimeout(debounce);
    if (q.trim().length < 3) return;
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await territoriesApi.searchStreets(q.trim());
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    setDebounce(t);
  }

  // ── Adicionar rua (via resultado ou manual) ─────────────────────────────

  const addStreet = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (streets.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
        setQuery("");
        setResults([]);
        return;
      }
      setAddLoading(true);
      setError("");
      try {
        const { data } = await territoriesApi.addStreet(territoryId, { name: trimmed });
        setStreets((prev) => [...prev, { id: data.id, name: data.name }]);
        setQuery("");
        setResults([]);
        setMapSuccess(false); // mapa desatualizado
      } catch {
        setError("Erro ao adicionar a rua. Tente novamente.");
      } finally {
        setAddLoading(false);
      }
    },
    [territoryId, streets]
  );

  function handleSelectResult(r: StreetResult) {
    const name = r.logradouro || r.bairro;
    if (name) addStreet(name);
  }

  function handleAddManual() {
    if (query.trim()) addStreet(query.trim());
  }

  // ── Remover rua ─────────────────────────────────────────────────────────

  async function handleRemove(streetId: string) {
    setRemovingId(streetId);
    setError("");
    try {
      await territoriesApi.removeStreet(territoryId, streetId);
      setStreets((prev) => prev.filter((s) => s.id !== streetId));
      setMapSuccess(false);
    } catch {
      setError("Erro ao remover a rua. Tente novamente.");
    } finally {
      setRemovingId(null);
    }
  }

  // ── Regerar mapa ─────────────────────────────────────────────────────────

  async function handleGenerateMap() {
    setMapLoading(true);
    setMapError("");
    setMapSuccess(false);
    try {
      await territoriesApi.generateMap(territoryId);
      setMapSuccess(true);
      onUpdated();
    } catch {
      setMapError("Não foi possível gerar o mapa. Verifique os nomes das ruas.");
    } finally {
      setMapLoading(false);
    }
  }

  // ── Fechar e notificar ───────────────────────────────────────────────────

  function handleClose() {
    onUpdated();
    onClose();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl overflow-y-auto"
        style={{
          maxHeight: "92dvh",
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-border)" }} />
        </div>

        <div className="px-5 pt-3 pb-8 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-text)]">Editar Território</h2>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "var(--color-surface-card)" }}
              aria-label="Fechar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-4 h-4" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Ruas atuais ─────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-2">
              Ruas — {streets.length} total
            </p>
            <div className="flex flex-col gap-2">
              {streets.length === 0 ? (
                <p className="text-sm text-[var(--color-text-light)] text-center py-4">
                  Nenhuma rua cadastrada.
                </p>
              ) : (
                streets.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)" }}
                  >
                    {/* Ícone */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--color-primary-soft)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"
                        className="w-4 h-4" aria-hidden="true">
                        <path d="M3 12h18M3 6h18M3 18h18" />
                      </svg>
                    </div>

                    <span className="flex-1 text-sm font-medium text-[var(--color-text)] truncate">
                      {s.name}
                    </span>

                    {/* Botão remover */}
                    <button
                      type="button"
                      onClick={() => handleRemove(s.id)}
                      disabled={removingId === s.id}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.12)" }}
                      aria-label={`Remover ${s.name}`}
                    >
                      {removingId === s.id ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"
                          stroke="#f87171" strokeWidth="2" aria-hidden="true">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"
                          className="w-4 h-4" aria-hidden="true">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Adicionar rua ────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-2">
              Adicionar Rua
            </p>

            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddManual(); }
                }}
                placeholder="Buscar ou digitar nome da rua..."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none pr-12"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              {/* Botão adicionar manual */}
              <button
                type="button"
                onClick={handleAddManual}
                disabled={!query.trim() || addLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: "var(--color-primary)" }}
                aria-label="Adicionar rua"
              >
                {addLoading ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth="2" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"
                    className="w-4 h-4" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
            </div>

            {/* Resultados da busca */}
            {(searchLoading || results.length > 0) && (
              <div className="mt-1 rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-card)" }}>
                {searchLoading ? (
                  <p className="text-sm text-[var(--color-text-light)] text-center py-3">
                    Buscando...
                  </p>
                ) : (
                  results.map((r) => {
                    const name = r.logradouro || r.bairro;
                    return (
                      <button
                        key={r.cep}
                        type="button"
                        onClick={() => handleSelectResult(r)}
                        className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/5 active:bg-white/10"
                        style={{ color: "var(--color-text)", borderTop: "1px solid var(--color-border)" }}
                      >
                        <span className="font-medium">{name}</span>
                        {r.bairro && r.logradouro && (
                          <span className="text-xs text-[var(--color-text-light)] ml-2">{r.bairro}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── Erros ────────────────────────────────────────────────── */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* ── Regerar Mapa ─────────────────────────────────────────── */}
          {streets.length >= 2 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGenerateMap}
                disabled={mapLoading || mapSuccess}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{
                  background: mapSuccess
                    ? "rgba(34,197,94,0.15)"
                    : "var(--color-primary)",
                  color: mapSuccess ? "#4ade80" : "#fff",
                  border: mapSuccess ? "1px solid rgba(34,197,94,0.3)" : "none",
                }}
              >
                {mapLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Gerando mapa...
                  </>
                ) : mapSuccess ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="w-4 h-4" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Mapa Gerado!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="w-4 h-4" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                      <path d="M12 8v4l2 2" />
                    </svg>
                    Regerar Mapa
                  </>
                )}
              </button>

              {mapError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {mapError}
                </p>
              )}
            </div>
          )}

          {/* ── Fechar ───────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 rounded-2xl text-sm font-medium"
            style={{ background: "var(--color-surface-card)", color: "var(--color-text-light)" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
