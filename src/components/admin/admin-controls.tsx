"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export type AdminControlOption = {
  label: string;
  value: string;
};

type CustomSelectProps = {
  defaultValue?: string;
  disabled?: boolean;
  label: string;
  name: string;
  options: AdminControlOption[];
};

type DateFieldProps = {
  defaultValue?: string;
  label: string;
  name: string;
};

type MonthFieldProps = DateFieldProps;

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
  year: "numeric"
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric"
});

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isoMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}

function parseDate(value: string | undefined) {
  if (!value) return new Date();
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseMonth(value: string | undefined) {
  if (!value) return new Date();
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function monthLabel(value: string | undefined) {
  if (!value) return "Selecionar mês";
  return monthFormatter.format(parseMonth(value)).replace(/^\w/, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | undefined) {
  if (!value) return "dd/mm/aaaa";
  return dateFormatter.format(parseDate(value));
}

function daysInMonth(viewDate: Date) {
  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function startWeekday(viewDate: Date) {
  return new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1)).getUTCDay();
}

function moveMonth(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function useCloseOnOutsideClick<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose, open]);

  return ref;
}

export function AdminCustomSelect({
  defaultValue,
  disabled,
  label,
  name,
  options
}: CustomSelectProps) {
  const fallback = options[0]?.value ?? "";
  const initial = options.some((option) => option.value === defaultValue) ? defaultValue : fallback;
  const [value, setValue] = useState(initial ?? "");
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useCloseOnOutsideClick<HTMLLabelElement>(open, () => setOpen(false));
  const selected = options[selectedIndex] ?? options[0];

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    setValue(option.value);
    setActiveIndex(index);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement | HTMLDivElement>) {
    if (disabled) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + direction + options.length) % options.length;
      setActiveIndex(next);
      setOpen(true);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex);
      } else {
        commit(activeIndex);
      }
    }
  }

  return (
    <label className="admin-field admin-custom-select" ref={wrapperRef}>
      <span>{label}</span>
      <input name={name} type="hidden" value={value} />
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="admin-control-trigger"
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
          setActiveIndex(selectedIndex);
        }}
        onKeyDown={onKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span>{selected?.label ?? "Selecionar"}</span>
        <span aria-hidden="true" className="admin-control-arrow">⌄</span>
      </button>
      {open ? (
        <div
          aria-label={label}
          className="admin-control-popover"
          onKeyDown={onKeyDown}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={index === activeIndex ? "active" : ""}
              key={option.value}
              onClick={() => commit(index)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

export function AdminDateField({ defaultValue, label, name }: DateFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [viewDate, setViewDate] = useState(parseDate(defaultValue));
  const [open, setOpen] = useState(false);
  const wrapperRef = useCloseOnOutsideClick<HTMLLabelElement>(open, () => setOpen(false));
  const days = daysInMonth(viewDate);
  const offset = startWeekday(viewDate);

  function choose(day: number) {
    const next = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day));
    setValue(isoDate(next));
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <label className="admin-field admin-date-control" onKeyDown={onKeyDown} ref={wrapperRef}>
      <span>{label}</span>
      <input name={name} type="hidden" value={value} />
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="admin-control-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{dateLabel(value)}</span>
        <span aria-hidden="true" className="admin-control-arrow">▦</span>
      </button>
      {open ? (
        <div className="admin-control-popover admin-calendar-popover" role="dialog">
          <header>
            <button onClick={() => setViewDate((current) => moveMonth(current, -1))} type="button">‹</button>
            <strong>{monthLabel(isoMonth(viewDate))}</strong>
            <button onClick={() => setViewDate((current) => moveMonth(current, 1))} type="button">›</button>
          </header>
          <div className="admin-calendar-grid muted">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="admin-calendar-grid">
            {Array.from({ length: offset }, (_, index) => (
              <span aria-hidden="true" key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const dayValue = isoDate(new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day)));
              return (
                <button
                  className={value === dayValue ? "selected" : ""}
                  key={dayValue}
                  onClick={() => choose(day)}
                  type="button"
                >
                  {day}
                </button>
              );
            })}
          </div>
          <footer>
            <button onClick={() => setValue("")} type="button">Limpar</button>
            <button onClick={() => {
              const today = new Date();
              const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
              setViewDate(utcToday);
              setValue(isoDate(utcToday));
              setOpen(false);
            }} type="button">
              Hoje
            </button>
          </footer>
        </div>
      ) : null}
    </label>
  );
}

export function AdminMonthField({ defaultValue, label, name }: MonthFieldProps) {
  const [value, setValue] = useState(defaultValue ?? isoMonth(new Date()));
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const viewDate = useMemo(() => parseMonth(draft), [draft]);
  const wrapperRef = useCloseOnOutsideClick<HTMLLabelElement>(open, () => setOpen(false));

  function shift(delta: number) {
    setDraft((current) => isoMonth(moveMonth(parseMonth(current), delta)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      setValue(draft);
      setOpen(false);
    }
  }

  return (
    <label className="admin-field admin-month-control" onKeyDown={onKeyDown} ref={wrapperRef}>
      <span>{label}</span>
      <input name={name} type="hidden" value={value} />
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="admin-control-trigger"
        onClick={() => {
          setDraft(value);
          setOpen((current) => !current);
        }}
        type="button"
      >
        <span>{monthLabel(value)}</span>
        <span aria-hidden="true" className="admin-control-arrow">⌄</span>
      </button>
      {open ? (
        <div className="admin-control-popover admin-month-popover" role="dialog">
          <header>
            <button onClick={() => shift(-1)} type="button">‹</button>
            <strong>{monthLabel(isoMonth(viewDate))}</strong>
            <button onClick={() => shift(1)} type="button">›</button>
          </header>
          <footer>
            <button onClick={() => setDraft(isoMonth(new Date()))} type="button">Hoje</button>
            <button onClick={() => {
              setValue(draft);
              setOpen(false);
            }} type="button">
              Aplicar
            </button>
          </footer>
        </div>
      ) : null}
    </label>
  );
}
