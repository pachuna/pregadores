"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuthStore } from "@/store/authStore";
import { authApi, pioneerApi, type PioneerReport } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function msToHMS(ms: number) {
  const s = Math.floor(ms / 1000);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const WEEKDAYS_SHORT = ["D","S","T","Q","Q","S","S"];
const WEEKDAYS_FULL = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

// ── Timer (persiste em localStorage) ─────────────────────────────────────────

const TIMER_KEY = "pioneiro-timer-v1";

interface TimerState {
  running: boolean;
  startedAt: number;
  accumulated: number;
}

const TIMER_IDLE: TimerState = { running: false, startedAt: 0, accumulated: 0 };

function loadTimerState(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (raw) return JSON.parse(raw) as TimerState;
  } catch {}
  return TIMER_IDLE;
}

function saveTimerState(t: TimerState) {
  localStorage.setItem(TIMER_KEY, JSON.stringify(t));
}

function getElapsedMs(t: TimerState): number {
  if (t.running) return Date.now() - t.startedAt + t.accumulated;
  return t.accumulated;
}

// ── Day data ──────────────────────────────────────────────────────────────────

interface DayData {
  hours: number;
  minutes: number;
  creditHours: number;
  bibleStudies: number;
  goalHours: number;
  notes: string;
}

const EMPTY_DAY: DayData = {
  hours: 0, minutes: 0, creditHours: 0,
  bibleStudies: 0, goalHours: 2, notes: "",
};

function reportToDayData(r: PioneerReport): DayData {
  return {
    hours: r.hours,
    minutes: r.minutes,
    creditHours: r.creditHours,
    bibleStudies: r.bibleStudies,
    goalHours: r.goalHours,
    notes: r.notes ?? "",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Counter({
  label, value, unit = "", min = 0, max = 99, onChange,
}: {
  label: string; value: number; unit?: string;
  min?: number; max?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
      <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Diminuir ${label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xl leading-none"
          style={{ background: "var(--color-primary)" }}
        >−</button>
        <span className="w-8 text-center font-bold text-base text-[var(--color-text)]">
          {value}{unit}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Aumentar ${label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xl leading-none"
          style={{ background: "var(--color-primary)" }}
        >+</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function PioneerContent() {
  const now = new Date();
  const router = useRouter();
  const name = useAuthStore((s) => s.name);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // melhor esforço
    } finally {
      logout();
      router.replace("/login");
    }
  };
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(todayStr());
  const [reports, setReports] = useState<PioneerReport[]>([]);
  const [dayData, setDayData] = useState<DayData>(EMPTY_DAY);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showResetModal, setShowResetModal] = useState(false);

  // Timer
  const [timer, setTimer] = useState<TimerState>(TIMER_IDLE);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load timer from localStorage on mount
  useEffect(() => {
    const t = loadTimerState();
    setTimer(t);
    setElapsed(getElapsedMs(t));
  }, []);

  // Timer tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timer.running) {
      intervalRef.current = setInterval(() => setElapsed(getElapsedMs(timer)), 500);
    } else {
      setElapsed(timer.accumulated);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer]);

  // Load month reports
  const loadReports = useCallback(async () => {
    try {
      const { data } = await pioneerApi.list(year, month);
      setReports(data);
    } catch {}
  }, [year, month]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Sync selected day → form
  useEffect(() => {
    const r = reports.find((r) => r.date === selected);
    setDayData(r ? reportToDayData(r) : { ...EMPTY_DAY });
  }, [selected, reports]);

  // Auto-save with 1.5s debounce
  const scheduleSave = useCallback(
    (data: DayData) => {
      setSaveState("idle");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          const { data: saved } = await pioneerApi.upsert({ date: selected, ...data });
          setReports((prev) => {
            const idx = prev.findIndex((r) => r.date === selected);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
          });
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        } catch {
          setSaveState("idle");
        }
      }, 1500);
    },
    [selected],
  );

  function updateField<K extends keyof DayData>(key: K, val: DayData[K]) {
    const next = { ...dayData, [key]: val };
    setDayData(next);
    scheduleSave(next);
  }

  // Timer controls
  function toggleTimer() {
    const next: TimerState = timer.running
      ? { running: false, startedAt: 0, accumulated: getElapsedMs(timer) }
      : { running: true, startedAt: Date.now(), accumulated: timer.accumulated };
    setTimer(next);
    saveTimerState(next);
    // Ao pausar: persiste o tempo acumulado no relatório do dia automaticamente
    if (timer.running) {
      const { h, m } = msToHMS(getElapsedMs(timer));
      const totalMin = dayData.hours * 60 + dayData.minutes + h * 60 + m;
      const saved = { ...dayData, hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
      setDayData(saved);
      scheduleSave(saved);
    }
  }

  function resetTimer() {
    setTimer(TIMER_IDLE);
    setElapsed(0);
    saveTimerState(TIMER_IDLE);
  }

  function addTimerToReport() {
    const { h, m } = msToHMS(elapsed);
    const totalMin = dayData.hours * 60 + dayData.minutes + h * 60 + m;
    const next = { ...dayData, hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
    setDayData(next);
    scheduleSave(next);
    resetTimer();
  }

  function handleResetClick() {
    if (elapsed > 0) {
      setShowResetModal(true);
    } else {
      resetTimer();
    }
  }

  function confirmResetAdd() {
    addTimerToReport();
    setShowResetModal(false);
  }

  function confirmResetDiscard() {
    resetTimer();
    setShowResetModal(false);
  }

  // Month navigation
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  // Calendar computations
  const totalDays = daysInMonth(year, month);
  const firstDay = firstWeekday(year, month);
  const reportMap = Object.fromEntries(reports.map((r) => [r.date, r]));
  const today = todayStr();

  // Monthly totals
  const totMin = reports.reduce((acc, r) => acc + r.hours * 60 + r.minutes + r.creditHours * 60, 0);
  const totH = Math.floor(totMin / 60);
  const totM = totMin % 60;
  const totStudies = reports.reduce((acc, r) => acc + r.bibleStudies, 0);
  const totCredit = reports.reduce((acc, r) => acc + r.creditHours, 0);

  // Progress bar
  const workedMin = dayData.hours * 60 + dayData.minutes;
  const goalMin = dayData.goalHours * 60;
  const progress = goalMin > 0 ? Math.min(1, workedMin / goalMin) : 0;

  // Selected day labels
  const selParts = selected.split("-").map(Number);
  const selDate = new Date(selParts[0], selParts[1] - 1, selParts[2]);
  const selDayLabel = `${WEEKDAYS_FULL[selDate.getDay()]}, ${selParts[2]} de ${MONTHS[selParts[1] - 1]}`;

  // Timer display
  const { h: th, m: tm, s: ts } = msToHMS(elapsed);
  const timerAngle = (elapsed % 3600000) / 3600000;
  const R = 44;
  const circ = 2 * Math.PI * R;

  return (
    <div className="mobile-page min-h-screen pb-28 bg-[var(--color-bg)]">

      {/* ── Modal Zerar ── */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
          style={{ background: "rgba(15,23,40,0.55)" }}
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-strong)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-2">
              <p className="font-bold text-base text-[var(--color-text)] mb-1">Zerar cronômetro</p>
              <p className="text-sm text-[var(--color-text-light)]">
                O que deseja fazer com <span className="font-semibold text-[var(--color-text)]">{pad(th)}h {pad(tm)}min {pad(ts)}s</span> registrado?
              </p>
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5 pt-3">
              <button
                type="button"
                onClick={confirmResetAdd}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                style={{ background: "var(--color-primary)" }}
              >
                Adicionar ao relatório do dia
              </button>
              <button
                type="button"
                onClick={confirmResetDiscard}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ background: "var(--color-surface)", color: "var(--color-danger)" }}
              >
                Descartar tempo
              </button>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-full py-2 text-xs"
                style={{ color: "var(--color-text-light)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="mobile-header justify-between">
        <div>
          <p className="mobile-header__meta">Pioneiro</p>
          <h1 className="mobile-header__title">{name ?? "Relatório de serviço"}</h1>
        </div>
        <button
          className="text-sm w-auto px-3 py-2 rounded-lg border border-white/35 text-white font-semibold bg-white/10 hover:bg-white/20 transition-colors"
          onClick={handleLogout}
          type="button"
        >
          Sair
        </button>
      </header>

      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "var(--color-surface-elevated)", borderBottom: "1px solid var(--color-border)" }}>
        <button type="button" onClick={prevMonth} aria-label="Mês anterior"
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="text-center">
          <span className="text-[var(--color-text)] font-semibold text-base">{MONTHS[month - 1]} {year}</span>
          <p className="text-xs text-[var(--color-text-light)] mt-0.5">{totH}h{totM > 0 ? ` ${totM}min` : ""} no mês</p>
        </div>
        <button type="button" onClick={nextMonth} aria-label="Próximo mês"
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* ── Calendar ── */}
      <div className="px-3 pt-3 pb-1">
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-soft)", border: "1px solid var(--color-border)" }}>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1 pt-2 px-1">
            {WEEKDAYS_SHORT.map((d, i) => (
              <div key={i} className="text-center text-xs font-semibold py-1"
                style={{ color: i === 0 ? "var(--color-danger)" : "var(--color-text-light)" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5 pb-2 px-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const dateStr = toDateStr(year, month, day);
            const report = reportMap[dateStr];
            const isToday = dateStr === today;
            const isSel = dateStr === selected;
            const hasData = report && (report.hours > 0 || report.minutes > 0);
            const goalMet = report && report.goalHours > 0 &&
              (report.hours * 60 + report.minutes) >= report.goalHours * 60;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelected(dateStr)}
                aria-label={`Selecionar dia ${day}`}
                aria-pressed={isSel}
                className="flex flex-col items-center pt-1.5 pb-1 rounded-xl transition-all"
                style={{
                  background: isSel ? "var(--color-primary)" : "transparent",
                  outline: isToday && !isSel ? "2px solid var(--color-primary)" : "none",
                  outlineOffset: "-2px",
                }}
              >
                <span className="text-xs font-bold leading-none"
                  style={{ color: isSel ? "#fff" : isToday ? "var(--color-primary)" : "var(--color-text)" }}>
                  {day}
                </span>
                <div className="w-1.5 h-1.5 rounded-full mt-1"
                  style={{
                    background: goalMet ? "#16a34a" : hasData ? (isSel ? "rgba(255,255,255,0.6)" : "var(--color-primary)") : "transparent",
                  }}
                />
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 flex flex-col gap-4">

        {/* ── Day card ── */}
        <div className="card">

          {/* Card header */}
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-[var(--color-text)] text-sm">{selDayLabel}</p>
            <span className="text-xs" style={{
              color: saveState === "saved" ? "#16a34a" : "var(--color-text-light)",
            }}>
              {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "✓ Salvo" : ""}
            </span>
          </div>

          {/* ── Cronômetro ── */}
          <div className="rounded-2xl py-5 px-4 mb-5 flex flex-col items-center"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-4">
              Cronômetro
            </p>

            {/* Circular progress + time display */}
            <div className="relative w-36 h-36 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={R} fill="none"
                  stroke="var(--color-border)" strokeWidth="5" />
                <circle cx="50" cy="50" r={R} fill="none"
                  stroke={timer.running ? "var(--color-primary)" : "var(--color-text-light)"}
                  strokeWidth="5"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - timerAngle)}
                  strokeLinecap="round"
                  style={{ transition: timer.running ? "stroke-dashoffset 0.5s linear" : "none" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-bold text-2xl tabular-nums text-[var(--color-text)]">
                  {pad(th)}:{pad(tm)}:{pad(ts)}
                </span>
                {timer.running && (
                  <span className="text-xs text-[var(--color-primary)] mt-0.5 font-semibold animate-pulse">
                    ● Contando
                  </span>
                )}
              </div>
            </div>

            {/* Timer buttons */}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                type="button"
                onClick={toggleTimer}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white shadow-sm"
                style={{ background: timer.running ? "var(--color-danger)" : "var(--color-primary)" }}
              >
                {timer.running ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                    Pausar
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    {elapsed > 0 ? "Retomar" : "Iniciar"}
                  </>
                )}
              </button>

              {elapsed > 0 && (
                <button
                  type="button"
                  onClick={handleResetClick}
                  className="px-3 py-2.5 rounded-full text-xs text-[var(--color-text-light)] border"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  Zerar
                </button>
              )}
            </div>
          </div>

          {/* ── Contadores ── */}
          <div className="mb-2">
            <div className="flex gap-3 mb-0">
              {/* Horas */}
              <div className="flex-1 flex flex-col items-center py-3 rounded-xl border gap-2"
                style={{ borderColor: "var(--color-border)" }}>
                <span className="text-xs font-semibold text-[var(--color-text-light)]">Horas</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateField("hours", Math.max(0, dayData.hours - 1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: "var(--color-primary)" }}>−</button>
                  <span className="w-7 text-center font-bold text-xl text-[var(--color-text)]">{dayData.hours}</span>
                  <button type="button" onClick={() => updateField("hours", Math.min(23, dayData.hours + 1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: "var(--color-primary)" }}>+</button>
                </div>
              </div>
              {/* Minutos */}
              <div className="flex-1 flex flex-col items-center py-3 rounded-xl border gap-2"
                style={{ borderColor: "var(--color-border)" }}>
                <span className="text-xs font-semibold text-[var(--color-text-light)]">Minutos</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateField("minutes", Math.max(0, dayData.minutes - 1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: "var(--color-primary)" }}>−</button>
                  <span className="w-7 text-center font-bold text-xl text-[var(--color-text)]">{dayData.minutes}</span>
                  <button type="button" onClick={() => updateField("minutes", Math.min(59, dayData.minutes + 1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: "var(--color-primary)" }}>+</button>
                </div>
              </div>
            </div>
          </div>

          <Counter label="Estudos Bíblicos" value={dayData.bibleStudies}
            onChange={(v) => updateField("bibleStudies", v)} />
          <Counter label="Horas de Crédito" value={dayData.creditHours} unit="h"
            onChange={(v) => updateField("creditHours", v)} />

          {/* Meta do dia + barra de progresso */}
          <div className="py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-medium text-[var(--color-text)]">Meta do dia</span>
                {dayData.goalHours > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: progress >= 1 ? "#16a34a" : "var(--color-text-light)" }}>
                    {dayData.hours}h {dayData.minutes}min de {dayData.goalHours}h
                    {progress >= 1 && " · ✓ Atingida!"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => updateField("goalHours", Math.max(0, dayData.goalHours - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: "var(--color-primary)" }}>−</button>
                <span className="w-8 text-center font-bold text-base text-[var(--color-text)]">
                  {dayData.goalHours}h
                </span>
                <button type="button" onClick={() => updateField("goalHours", dayData.goalHours + 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: "var(--color-primary)" }}>+</button>
              </div>
            </div>
            {dayData.goalHours > 0 && (
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress * 100}%`,
                    background: progress >= 1 ? "#16a34a" : "var(--color-primary)",
                  }}
                />
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="pt-4">
            <label className="text-sm font-medium text-[var(--color-text)] block mb-2">
              Notas
            </label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              placeholder="Observações do dia..."
              value={dayData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>
        </div>

        {/* ── Resumo mensal ── */}
        <div className="pb-2">
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-3">
            Resumo — {MONTHS[month - 1]} {year}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Horas", value: `${totH}h`, sub: totM > 0 ? `${totM}min` : undefined, color: "var(--color-primary)" },
              { label: "Estudos", value: String(totStudies), color: "var(--color-accent, #c18f59)" },
              { label: "Crédito", value: `${totCredit}h`, color: "#16a34a" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="card text-center py-4 px-2">
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                {sub && <p className="text-xs font-semibold" style={{ color }}>{sub}</p>}
                <p className="text-xs text-[var(--color-text-light)] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <MobileBottomNav />
    </div>
  );
}

export default function PioneerPage() {
  return (
    <AuthGuard>
      <PioneerContent />
    </AuthGuard>
  );
}
