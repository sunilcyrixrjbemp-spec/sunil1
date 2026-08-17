import React from "react";
import { getBand, PASS_THRESHOLD } from "../../services/kpiService";

// ─── Score Badge ──────────────────────────────────────────────────────────────

interface ScoreBadgeProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const band = getBand(score);
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-sm font-bold" : size === "md" ? "px-2.5 py-1 text-xs font-semibold" : "px-2 py-0.5 text-xs font-medium";

  if (!band || score === null || score === undefined) {
    return (
      <span className={`inline-flex items-center rounded-full border bg-gray-100 text-gray-500 border-gray-200 ${sizeClass}`}>
        Not Scored
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border ${band.chipClass} ${sizeClass}`}
      style={{ borderColor: band.hex.base + "40" }}
    >
      {band.label}
    </span>
  );
}

// ─── Score Number Display ─────────────────────────────────────────────────────

interface ScoreNumberProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  showOutOf?: boolean;
}

export function ScoreNumber({ score, size = "md", showOutOf = false }: ScoreNumberProps) {
  const band = getBand(score);
  const sizeClass = {
    sm: "text-lg font-bold",
    md: "text-2xl font-bold",
    lg: "text-4xl font-bold",
    xl: "text-6xl font-bold",
  }[size];

  if (score === null || score === undefined) {
    return <span className={`${sizeClass} text-gray-300`}>—</span>;
  }

  return (
    <span className={`${sizeClass} tabular-nums`} style={{ color: band?.hex.base ?? "#141519" }}>
      {score.toFixed(1)}
      {showOutOf && <span className="text-gray-400 font-normal text-[0.5em] ml-1">/100</span>}
    </span>
  );
}

// ─── KPI Status Badge ─────────────────────────────────────────────────────────

type SubmissionStatus = "draft" | "submitted" | "scored" | "finalized" | "returned" | null;

const STATUS_CONFIG: Record<NonNullable<SubmissionStatus>, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-600 border-gray-200" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  scored:    { label: "Scored",    className: "bg-purple-100 text-purple-700 border-purple-200" },
  finalized: { label: "Finalized", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  returned:  { label: "Returned",  className: "bg-amber-100 text-amber-700 border-amber-200" },
};

export function KpiStatusBadge({ status }: { status: SubmissionStatus }) {
  if (!status) return <span className="text-xs text-gray-400">Not started</span>;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Assignment Status Badge ──────────────────────────────────────────────────

type AssignmentStatus = "draft" | "pending_approval" | "active" | "rejected" | null;

export function KpiAssignmentBadge({ status }: { status: AssignmentStatus }) {
  const cfg: Record<NonNullable<AssignmentStatus>, { label: string; className: string }> = {
    draft:            { label: "Draft",            className: "bg-gray-100 text-gray-600 border-gray-200" },
    pending_approval: { label: "Awaiting Approval", className: "bg-blue-100 text-blue-700 border-blue-200" },
    active:           { label: "Active",            className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    rejected:         { label: "Returned",          className: "bg-red-100 text-red-700 border-red-200" },
  };
  if (!status) return <span className="text-xs text-gray-400">Not Set Up</span>;
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

// ─── KRA Attainment Bar ───────────────────────────────────────────────────────

interface KraAttainmentBarProps {
  kraName: string;
  attainmentPct: number | null;
  section?: string;
}

export function KraAttainmentBar({ kraName, attainmentPct, section }: KraAttainmentBarProps) {
  const band = getBand(attainmentPct);
  const pct = Math.max(0, Math.min(100, attainmentPct ?? 0));

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-gray-700 font-medium">{kraName}</span>
        <span
          className={`text-xs font-semibold tabular-nums shrink-0 ${band?.accentClass ?? "text-gray-400"}`}
        >
          {attainmentPct !== null ? `${attainmentPct.toFixed(0)}%` : "—"}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
        {/* Bar fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${band?.barClass ?? "bg-gray-300"}`}
          style={{ width: `${pct}%` }}
        />
        {/* Pass threshold marker at 60% */}
        <div
          className="absolute inset-y-0 w-px bg-gray-400/60"
          style={{ left: `${PASS_THRESHOLD}%` }}
          title={`Below ${PASS_THRESHOLD}% needs attention`}
        />
      </div>
      {section && <p className="text-xs text-gray-400">{section}</p>}
    </div>
  );
}

// ─── Score Trend Chart (Recharts LineChart) ───────────────────────────────────

interface TrendPoint {
  month: string;
  score: number | null;
}

interface ScoreTrendChartProps {
  points: TrendPoint[];
  height?: number;
}

export function ScoreTrendChart({ points, height = 180 }: ScoreTrendChartProps) {
  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No data yet
      </div>
    );
  }

  // Simple SVG line chart — no recharts dependency needed
  const validPoints = points.filter((p) => p.score !== null);
  if (validPoints.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No scored months yet
      </div>
    );
  }

  const W = 600;
  const H = height;
  const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xs = points.map((_, i) => PAD.left + (i / Math.max(points.length - 1, 1)) * chartW);
  const ys = points.map((p) =>
    p.score !== null
      ? PAD.top + chartH - (p.score / 100) * chartH
      : null
  );

  // Build SVG path string
  const pathParts: string[] = [];
  let inPath = false;
  for (let i = 0; i < points.length; i++) {
    if (ys[i] === null) { inPath = false; continue; }
    if (!inPath) {
      pathParts.push(`M ${xs[i].toFixed(1)} ${(ys[i] as number).toFixed(1)}`);
      inPath = true;
    } else {
      pathParts.push(`L ${xs[i].toFixed(1)} ${(ys[i] as number).toFixed(1)}`);
    }
  }
  const pathD = pathParts.join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      aria-label="Score trend chart"
    >
      {/* Band reference lines */}
      {[90, 80, 60, 40].map((v) => {
        const y = PAD.top + chartH - (v / 100) * chartH;
        return (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {v}
            </text>
          </g>
        );
      })}

      {/* Score line */}
      <path
        d={pathD}
        fill="none"
        stroke="#141519"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => {
        if (ys[i] === null) return null;
        const band = getBand(p.score);
        return (
          <g key={i}>
            <circle
              cx={xs[i]}
              cy={ys[i] as number}
              r="5"
              fill={band?.hex.base ?? "#141519"}
              stroke="white"
              strokeWidth="2"
            />
            <title>{`${p.month}: ${p.score?.toFixed(1)}`}</title>
          </g>
        );
      })}

      {/* X-axis labels — show every other month if many */}
      {points.map((p, i) => {
        if (points.length > 6 && i % 2 !== 0) return null;
        const label = p.month.split("-")[0]; // "Apr"
        return (
          <text
            key={i}
            x={xs[i]}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#9ca3af"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Score Hero Card ──────────────────────────────────────────────────────────

interface ScoreHeroProps {
  title: string;
  subtitle?: string;
  score: number | null | undefined;
  scoreLabel?: string;
  children?: React.ReactNode;
}

export function ScoreHero({ title, subtitle, score, scoreLabel = "Average", children }: ScoreHeroProps) {
  const band = getBand(score);
  const pct = Math.max(0, Math.min(100, score ?? 0));

  return (
    <section
      className="relative overflow-hidden rounded-2xl text-white"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      {/* Ambient glow */}
      {band && (
        <div
          className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full blur-3xl opacity-20"
          style={{ background: band.hex.base }}
        />
      )}

      <div className="relative flex flex-wrap items-end justify-between gap-4 p-6 sm:gap-6 sm:p-7">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-white/50">{subtitle}</p>}
        </div>

        {score !== null && score !== undefined && band ? (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{scoreLabel}</p>
            <p className="mt-1 tabular-nums font-bold leading-none" style={{ fontSize: "3.5rem", color: band.hex.soft }}>
              {score.toFixed(1)}
              <span className="ml-1 text-lg font-medium text-white/30">/100</span>
            </p>
            <ScoreBadge score={score} size="md" />
          </div>
        ) : (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{scoreLabel}</p>
            <p className="mt-1 text-5xl font-bold leading-none text-white/25">—</p>
            <span className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/50">
              Not Scored Yet
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative px-6 pb-6 sm:px-7 sm:pb-7">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
          {band && (
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: band.hex.base }}
            />
          )}
          {/* Band dividers */}
          {[40, 60, 80, 90].map((v) => (
            <span
              key={v}
              className="absolute inset-y-0 w-px bg-white/20"
              style={{ left: `${v}%` }}
            />
          ))}
        </div>

        {/* Band labels */}
        <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-widest text-white/30">
          <span>Poor</span>
          <span>Satisfactory</span>
          <span>Good</span>
          <span>Very Good</span>
          <span>Excellent</span>
        </div>
      </div>

      {children && (
        <div className="relative border-t border-white/10 px-6 py-4 sm:px-7">{children}</div>
      )}
    </section>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="mt-2 text-xl font-bold text-gray-900">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Action Alert Card ────────────────────────────────────────────────────────

interface ActionAlertProps {
  eyebrow?: string;
  title: string;
  body?: React.ReactNode;
  cta: string;
  onClick: () => void;
  variant?: "danger" | "warning" | "info";
}

export function ActionAlert({ eyebrow = "Action Required", title, body, cta, onClick, variant = "danger" }: ActionAlertProps) {
  const borderColor = variant === "danger" ? "border-red-600" : variant === "warning" ? "border-amber-500" : "border-blue-500";
  const ctaColor = "bg-white text-gray-900 hover:bg-red-600 hover:text-white";

  return (
    <div className="relative overflow-hidden rounded-xl bg-gray-950 text-white">
      <span className={`absolute inset-y-0 left-0 w-1 ${borderColor.replace("border-", "bg-")}`} />
      <div className="flex flex-col gap-4 p-5 pl-7 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-red-400">{eyebrow}</p>
            <p className="mt-1.5 text-base font-semibold sm:text-lg">{title}</p>
            {body && <div className="mt-1 text-sm text-white/60">{body}</div>}
          </div>
        </div>
        <button
          onClick={onClick}
          className={`shrink-0 rounded-lg px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest transition-colors ${ctaColor}`}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
