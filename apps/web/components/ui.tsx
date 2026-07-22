"use client";

// Native-feeling Telegram Mini App component kit. Everything here maps to the
// grouped-inset-list language Telegram/iOS users already know: a colored icon
// tile, a title, an optional subtitle, and a trailing chevron / value / switch.
// Pages compose these instead of hand-rolling divs, so the whole app looks like
// one designed product rather than a stack of forms.

import type { Route } from "next";
import Link from "next/link";
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { getBackButton, getMainButton, haptic } from "../lib/telegram";

export type Tone =
  | "brand"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "teal"
  | "pink"
  | "gray";

/** Page shell — one consistent width, rhythm and safe-area padding. */
export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={className ? `screen ${className}` : "screen"}>
      {children}
    </main>
  );
}

/** Brand header: a gradient app mark, a title and a one-line subtitle. */
export function AppHeader({
  title,
  subtitle,
  glyph = "◆",
  tone = "brand",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  glyph?: ReactNode;
  tone?: Tone;
}) {
  return (
    <header className="app-head">
      <span className={`app-mark tone-${tone}`} aria-hidden="true">
        {glyph}
      </span>
      <h1 className="app-title">{title}</h1>
      {subtitle != null && <p className="app-sub">{subtitle}</p>}
    </header>
  );
}

/** Uppercase caption above a group — the Telegram/iOS section label. */
export function Caption({ children }: { children: ReactNode }) {
  return <div className="cap">{children}</div>;
}

/** The inset rounded card that holds rows (or any content). */
export function Group({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `group ${className}` : "group"}>{children}</div>
  );
}

/** A short muted note under a group, explaining what the setting does. */
export function GroupNote({ children }: { children: ReactNode }) {
  return <p className="group-note">{children}</p>;
}

/** A labeled block of the page — an optional Caption plus its content. */
export function Section({
  caption,
  children,
}: {
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sec">
      {caption != null && <Caption>{caption}</Caption>}
      {children}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className="chev"
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 1l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface RowProps {
  icon?: ReactNode;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  trailing?: ReactNode;
  href?: Route;
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

/** One list row. Renders as a link, a button or a static row automatically. */
export function Row({
  icon,
  tone = "gray",
  title,
  subtitle,
  value,
  chevron,
  trailing,
  href,
  external,
  onClick,
  disabled,
}: RowProps) {
  const inner = (
    <>
      {icon != null && (
        <span className="row-icon" aria-hidden="true">
          <span className={`tile tone-${tone}`}>{icon}</span>
        </span>
      )}
      <span className="row-body">
        <span className="row-text">
          <span className="row-title">{title}</span>
          {subtitle != null && <span className="row-sub">{subtitle}</span>}
        </span>
        {value != null && <span className="row-value">{value}</span>}
        {trailing}
        {chevron && <Chevron />}
      </span>
    </>
  );

  if (href) {
    if (external) {
      return (
        <a
          className="row row-tap"
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={() => haptic.selection()}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link
        className="row row-tap"
        href={href}
        onClick={() => haptic.selection()}
      >
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className="row row-tap"
        disabled={disabled}
        onClick={() => {
          haptic.selection();
          onClick();
        }}
      >
        {inner}
      </button>
    );
  }
  return <div className="row">{inner}</div>;
}

/** iOS-style switch. A button, not a raw checkbox, so it can be themed. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? "toggle on" : "toggle"}
      onClick={() => {
        haptic.selection();
        onChange(!checked);
      }}
    >
      <span className="toggle-knob" />
    </button>
  );
}

/** One option in a {@link MultiToggleRow}. */
export interface MultiToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: string;
}

/**
 * A row with a title/subtitle and a grid of independent on/off toggles —
 * e.g. "which roles does this group have" where several can be true at once.
 */
export function MultiToggleRow<T extends string>({
  title,
  subtitle,
  options,
  selected,
  onToggle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  options: ReadonlyArray<MultiToggleOption<T>>;
  selected: readonly T[];
  onToggle: (value: T, enabled: boolean) => void;
}) {
  return (
    <div className="network-role-row">
      <div className="network-role-main">
        <strong className="network-role-title">{title}</strong>
        {subtitle != null && <span>{subtitle}</span>}
      </div>
      <div className="network-role-toggles">
        {options.map((opt) => (
          <div className="network-role-toggle" key={opt.value}>
            <span>{opt.label}</span>
            <Toggle
              checked={selected.includes(opt.value)}
              {...(opt.hint ? { label: `${opt.label}: ${opt.hint}` } : {})}
              onChange={(next) => onToggle(opt.value, next)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One choice in a {@link RouteRow}'s destination dropdown. */
export interface RouteOption {
  value: string;
  label: ReactNode;
}

/**
 * A row pairing a label/hint with a destination `<select>` — e.g. "where do
 * reports go". `mixedValue` renders an extra option when several underlying
 * values disagree (so the select can show "several groups" without forcing
 * a pick).
 */
export function RouteRow({
  label,
  hint,
  value,
  mixedValue,
  mixedLabel = "Varios grupos",
  emptyLabel,
  options,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  mixedValue?: string;
  mixedLabel?: ReactNode;
  emptyLabel: ReactNode;
  options: ReadonlyArray<RouteOption>;
  onChange: (next: string) => void;
}) {
  return (
    <div className="network-route-row">
      <div className="network-route-label">
        {label}
        {hint != null && <span>{hint}</span>}
      </div>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {mixedValue != null && value === mixedValue && (
          <option value={mixedValue}>{mixedLabel}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Segmented control for a small set of mutually-exclusive choices. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={opt.value === value ? "seg-item on" : "seg-item"}
          onClick={() => {
            haptic.selection();
            onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Labeled control wrapper: a caption, the field, and an optional hint. */
export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  // A div, not a <label>: some children are grouped controls (Segmented is a
  // tablist), so a single implicit label association would be wrong.
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint != null && <span className="field-hint">{hint}</span>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";

export function Button({
  children,
  variant = "primary",
  block,
  className,
  ...rest
}: {
  variant?: ButtonVariant;
  block?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    "btn",
    `btn-${variant}`,
    block ? "btn-block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/** Inline status banner — success / error / info, with a leading accent. */
export function Banner({
  kind = "info",
  children,
}: {
  kind?: "success" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <p
      className={`banner banner-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

/** Empty / zero state: a big soft icon, a title and a hint. */
export function Empty({
  icon,
  title,
  hint,
  tone = "gray",
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className={`empty-icon tone-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <p className="empty-title">{title}</p>
      {hint != null && <p className="empty-hint">{hint}</p>}
      {action}
    </div>
  );
}

/** Shimmer placeholder rows while a group loads. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="group" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, never reordered
        <div className="row" key={i}>
          <span className="row-icon">
            <span className="skel skel-tile" />
          </span>
          <span className="row-body">
            <span className="row-text">
              <span className="skel skel-line" style={{ width: "58%" }} />
              <span className="skel skel-line sm" style={{ width: "38%" }} />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Shimmer placeholder for the dashboard metric grid. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders, never reordered
        <div className="stat skel-stat" key={i}>
          <span
            className="skel skel-line"
            style={{ width: "50%", height: 26 }}
          />
          <span className="skel skel-line sm" style={{ width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Bind Telegram's native bottom MainButton for the life of a screen. Pass null
 * to hide it. The click handler is kept in a ref so it always sees fresh state
 * without re-subscribing on every render.
 */
export function useMainButton(
  opts: {
    text: string;
    onClick: () => void;
    visible?: boolean;
    enabled?: boolean;
    loading?: boolean;
  } | null,
) {
  const cb = useRef<(() => void) | undefined>(opts?.onClick);
  cb.current = opts?.onClick;
  const text = opts?.text;
  const visible = opts ? opts.visible !== false : false;
  const enabled = opts ? opts.enabled !== false : false;
  const loading = opts?.loading ?? false;

  useEffect(() => {
    const mb = getMainButton();
    if (!mb) {
      return;
    }
    if (!visible || !text) {
      mb.hide();
      return;
    }
    mb.setText(text);
    if (enabled) {
      mb.enable();
    } else {
      mb.disable();
    }
    if (loading) {
      mb.showProgress();
    } else {
      mb.hideProgress();
    }
    const handler = () => cb.current?.();
    mb.onClick(handler);
    mb.show();
    return () => {
      mb.offClick(handler);
      mb.hideProgress();
      mb.hide();
    };
  }, [text, visible, enabled, loading]);
}

/** Bind Telegram's native back arrow to a handler for the life of a screen. */
export function useBackButton(onBack?: () => void) {
  const cb = useRef<(() => void) | undefined>(onBack);
  cb.current = onBack;
  const active = Boolean(onBack);

  useEffect(() => {
    const bb = getBackButton();
    if (!bb || !active) {
      bb?.hide();
      return;
    }
    const handler = () => cb.current?.();
    bb.onClick(handler);
    bb.show();
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, [active]);
}
