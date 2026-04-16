"use client";

import { useState } from "react";
import { congregationsApi } from "@/lib/api";
import { useIBGEStates, useIBGECities } from "@/lib/ibge";

interface Props {
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function CongregationRequestForm({ onSuccess, onCancel }: Props) {
  const [name, setName] = useState("");
  const [jwEmail, setJwEmail] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { states, loading: loadingStates, error: errorStates } = useIBGEStates();
  const { cities, loading: loadingCities, error: errorCities } = useIBGECities(state);

  const handleStateChange = (value: string) => {
    setState(value);
    setCity("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await congregationsApi.create({ name, jwEmail, state, city });
      onSuccess();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error ===
          "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Erro ao enviar solicitação. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="cong-name" className="input-label">
          Nome da Congregação
        </label>
        <input
          id="cong-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Congregação Central"
          className="input mt-1"
          required
          maxLength={120}
        />
      </div>

      <div>
        <label htmlFor="cong-email" className="input-label">
          Email JW (para validação)
        </label>
        <input
          id="cong-email"
          type="email"
          value={jwEmail}
          onChange={(e) => setJwEmail(e.target.value)}
          placeholder="congregacao@jw.org"
          className="input mt-1"
          required
        />
      </div>

      <div>
        <label htmlFor="cong-state" className="input-label">
          Estado
        </label>
        <select
          id="cong-state"
          value={state}
          onChange={(e) => handleStateChange(e.target.value)}
          className="input mt-1"
          required
          disabled={loadingStates || errorStates}
        >
          <option value="">
            {loadingStates ? "Carregando estados..." : errorStates ? "Erro ao carregar estados" : "Selecione o estado"}
          </option>
          {states.map((s) => (
            <option key={s.sigla} value={s.sigla}>
              {s.nome} ({s.sigla})
            </option>
          ))}
        </select>
        {errorStates && (
          <p className="text-xs text-[var(--color-danger)] mt-1">
            Não foi possível carregar os estados.{" "}
            <button type="button" className="underline" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="cong-city" className="input-label">
          Cidade
        </label>
        <select
          id="cong-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="input mt-1"
          required
          disabled={!state || loadingCities}
        >
          <option value="">
            {!state
              ? "Selecione o estado primeiro"
              : loadingCities
              ? "Carregando cidades..."
              : errorCities
              ? "Erro ao carregar cidades"
              : "Selecione a cidade"}
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)] text-center">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={loading || !name || !jwEmail || !state || !city}
        >
          {loading ? "Enviando..." : "Enviar solicitação"}
        </button>
      </div>
    </form>
  );
}
