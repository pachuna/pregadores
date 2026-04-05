"use client";

import { useEffect, useState } from "react";

export interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}

export interface IBGECity {
  id: number;
  nome: string;
}

export function useIBGEStates() {
  const [states, setStates] = useState<IBGEState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((r) => r.json())
      .then((data: IBGEState[]) => setStates(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { states, loading };
}

export function useIBGECities(uf: string) {
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }
    setLoading(true);
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    )
      .then((r) => r.json())
      .then((data: IBGECity[]) => setCities(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uf]);

  return { cities, loading };
}
