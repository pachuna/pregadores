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
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    fetch("/api/ibge/states")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: IBGEState[]) => setStates(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { states, loading, error };
}

export function useIBGECities(uf: string) {
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/ibge/cities/${encodeURIComponent(uf)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: IBGECity[]) => setCities(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [uf]);

  return { cities, loading, error };
}
