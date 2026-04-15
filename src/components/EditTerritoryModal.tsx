"use client";

import { useCallback, useState } from "react";
import { territoriesApi, type TerritoryStreet, type TerritoryHouse } from "@/lib/api";

interface StreetResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EditTerritoryModal({
  territoryId,
  initialStreets,
  onClose,
  onUpdated,
}: {
  territoryId: string;
  initialStreets: TerritoryStreet[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [streets, setStreets] = useState<TerritoryStreet[]>(initialStreets);
  const [expandedStreetId, setExpandedStreetId] = useState<string | null>(null);

  // Adicionar rua
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StreetResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [debounce, setDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [addStreetLoading, setAddStreetLoading] = useState(false);

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
      setAddStreetLoading(true);
      setError("");
      try {
        const { data } = await territoriesApi.addStreet(territoryId, { name: trimmed });
        setStreets((prev) => [...prev, { id: data.id, name: data.name, lastUpdate: data.lastUpdate ?? null, houses: data.houses ?? [] }]);
        setQuery("");
        setResults([]);
        setMapSuccess(false); // mapa desatualizado
      } catch {
        setError("Erro ao adicionar a rua. Tente novamente.");
      } finally {
        setAddStreetLoading(false);
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
      if (expandedStreetId === streetId) setExpandedStreetId(null);
      setMapSuccess(false);
    } catch {
      setError("Erro ao remover a rua. Tente novamente.");
    } finally {
      setRemovingId(null);
    }
  }

  // ── Atualizar houses no state ────────────────────────────────────────────

  function updateStreetHouses(streetId: string, updater: (houses: TerritoryHouse[]) => TerritoryHouse[]) {
    setStreets((prev) =>
      prev.map((s) => (s.id === streetId ? { ...s, houses: updater(s.houses) } : s))
    );
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
                  <StreetRow
                    key={s.id}
                    street={s}
                    territoryId={territoryId}
                    expanded={expandedStreetId === s.id}
                    onToggle={() => setExpandedStreetId(expandedStreetId === s.id ? null : s.id)}
                    onRemove={() => handleRemove(s.id)}
                    removing={removingId === s.id}
                    onHousesChange={(updater) => updateStreetHouses(s.id, updater)}
                  />
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
                disabled={!query.trim() || addStreetLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: "var(--color-primary)" }}
                aria-label="Adicionar rua"
              >
                {addStreetLoading ? (
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

// ─────────────────────────────────────────────────────────────────────────────
// StreetRow — rua com expansão de casas
// ─────────────────────────────────────────────────────────────────────────────

function StreetRow({
  street,
  territoryId,
  expanded,
  onToggle,
  onRemove,
  removing,
  onHousesChange,
}: {
  street: TerritoryStreet;
  territoryId: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removing: boolean;
  onHousesChange: (updater: (houses: TerritoryHouse[]) => TerritoryHouse[]) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)" }}>
      {/* Cabeçalho da rua */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-primary-soft)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"
              className="w-4 h-4" aria-hidden="true">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">{street.name}</p>
            <p className="text-xs text-[var(--color-text-light)]">
              {street.houses.length} {street.houses.length === 1 ? "casa" : "casas"}
            </p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" strokeWidth="2"
            className={`w-4 h-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Botão remover rua */}
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
          style={{ background: "rgba(239,68,68,0.12)" }}
          aria-label={`Remover ${street.name}`}
        >
          {removing ? (
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

      {/* Painel expandido de casas */}
      {expanded && (
        <HousesPanel
          territoryId={territoryId}
          street={street}
          onHousesChange={onHousesChange}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HousesPanel — lista + add/edit/delete casas
// ─────────────────────────────────────────────────────────────────────────────

function HousesPanel({
  territoryId,
  street,
  onHousesChange,
}: {
  territoryId: string;
  street: TerritoryStreet;
  onHousesChange: (updater: (houses: TerritoryHouse[]) => TerritoryHouse[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Formulário adicionar
  const [addNumber, setAddNumber] = useState("");
  const [addObs, setAddObs] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  function showFeedback(type: "ok" | "err", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  // ── Adicionar casa ──────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const number = addNumber.trim();
    if (!number) return;
    setAddLoading(true);
    try {
      const { data } = await territoriesApi.addHouse(territoryId, street.id, {
        number,
        observation: addObs.trim() || undefined,
      });
      onHousesChange((prev) => [...prev, data]);
      setAddNumber("");
      setAddObs("");
      showFeedback("ok", "Casa adicionada.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao adicionar casa.";
      showFeedback("err", msg);
    } finally {
      setAddLoading(false);
    }
  }

  // ── Excluir casa ────────────────────────────────────────────────────────

  async function handleDelete(houseId: string) {
    setDeletingId(houseId);
    setConfirmDeleteId(null);
    try {
      await territoriesApi.deleteHouse(territoryId, street.id, houseId);
      onHousesChange((prev) => prev.filter((h) => h.id !== houseId));
      showFeedback("ok", "Casa removida.");
    } catch {
      showFeedback("err", "Erro ao remover casa.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="border-t px-4 py-3 flex flex-col gap-3"
      style={{ borderColor: "var(--color-border)" }}>

      {/* Feedback */}
      {feedback && (
        <p className="text-xs px-3 py-2 rounded-lg text-center"
          style={
            feedback.type === "ok"
              ? { background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }
              : { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }
          }>
          {feedback.msg}
        </p>
      )}

      {/* Lista de casas */}
      {street.houses.length === 0 ? (
        <p className="text-xs text-[var(--color-text-light)] text-center py-2">
          Nenhuma casa cadastrada nesta rua.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {street.houses.map((house) =>
            editingId === house.id ? (
              <HouseEditRow
                key={house.id}
                house={house}
                territoryId={territoryId}
                streetId={street.id}
                onSaved={(updated) => {
                  onHousesChange((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
                  setEditingId(null);
                  showFeedback("ok", "Casa atualizada.");
                }}
                onCancel={() => setEditingId(null)}
                onError={(msg) => showFeedback("err", msg)}
              />
            ) : (
              <div
                key={house.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">Nº {house.number}</p>
                  {house.observation && (
                    <p className="text-xs text-[var(--color-text-light)] truncate">{house.observation}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingId(house.id); setConfirmDeleteId(null); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(37,99,255,0.12)" }}
                  aria-label="Editar casa"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563ff" strokeWidth="2"
                    className="w-3.5 h-3.5" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {confirmDeleteId === house.id ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.08)", color: "var(--color-text-light)" }}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(house.id)}
                      disabled={deletingId === house.id}
                      className="text-xs px-2 py-1 rounded-lg font-semibold"
                      style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}
                    >
                      Sim
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(house.id)}
                    disabled={deletingId === house.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(239,68,68,0.12)" }}
                    aria-label="Remover casa"
                  >
                    {deletingId === house.id ? (
                      <div className="w-3 h-3 rounded-full border-2 border-[#f87171] border-t-transparent animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"
                        className="w-3.5 h-3.5" aria-hidden="true">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Formulário adicionar casa */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 pt-1">
        <p className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide">
          Adicionar casa
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={addNumber}
            onChange={(e) => setAddNumber(e.target.value)}
            placeholder="Número *"
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            maxLength={20}
          />
          <input
            type="text"
            value={addObs}
            onChange={(e) => setAddObs(e.target.value)}
            placeholder="Observação"
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            maxLength={100}
          />
        </div>
        <button
          type="submit"
          disabled={!addNumber.trim() || addLoading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          {addLoading ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Adicionando...</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> Adicionar casa</>
          )}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HouseEditRow — formulário inline de edição
// ─────────────────────────────────────────────────────────────────────────────

function HouseEditRow({
  house,
  territoryId,
  streetId,
  onSaved,
  onCancel,
  onError,
}: {
  house: TerritoryHouse;
  territoryId: string;
  streetId: string;
  onSaved: (updated: TerritoryHouse) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [number, setNumber] = useState(house.number);
  const [observation, setObservation] = useState(house.observation ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimNumber = number.trim();
    if (!trimNumber) return;
    setSaving(true);
    try {
      const { data } = await territoriesApi.updateHouse(territoryId, streetId, house.id, {
        number: trimNumber,
        observation: observation.trim() || undefined,
      });
      onSaved(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao salvar casa.";
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-2 rounded-lg px-3 py-2"
      style={{ background: "rgba(37,99,255,0.08)", border: "1px solid rgba(37,99,255,0.25)" }}
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Número *"
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          maxLength={20}
          autoFocus
        />
        <input
          type="text"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Observação"
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          maxLength={100}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", color: "var(--color-text-light)" }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!number.trim() || saving}
          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--color-primary)" }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
