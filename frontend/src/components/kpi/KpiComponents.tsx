import React from "react";
import { getBand, PASS_THRESHOLD } from "../../services/kpiService";
import { Target } from "lucide-react";

// ─── Score Badge ──────────────────────────────────────────────────────────────

interface ScoreBadgeProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const band = getBand(score);
  const sizeClass = size === "lg" 
    ? "px-3 py-1 text-xs font-bold font-mono tracking-wide" 
    : size === "md" 
    ? "px-2.5 py-0.5 text-[11px] font-semibold font-mono" 
    : "px-2 py-0.5 text-[10px] font-semibold font-mono";

  if (!band || score === null || score === undefined) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken text-ink-400 ${sizeClass}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-ink-300" />
        Not Scored
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${band.chipClass} ${sizeClass}`}
      style={{ borderColor: band.hex.base + "33" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: band.hex.base }} />
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
    sm: "text-lg font-bold font-mono",
    md: "text-2xl font-bold font-mono",
    lg: "text-4xl font-extrabold font-mono tracking-tight",
    xl: "text-5xl sm:text-6xl font-black font-mono tracking-tighter",
  }[size];

  if (score === null || score === undefined) {
    return <span className={`${sizeClass} text-ink-300 font-mono`}>—</span>;
  }

  return (
    <span className={`${sizeClass} tabular-nums`} style={{ color: band?.hex.base ?? "#12151A" }}>
      {score.toFixed(1)}
      {showOutOf && <span className="text-ink-400 font-normal text-[0.45em] ml-1.5">/100</span>}
    </span>
  );
}

// ─── KPI Status Badge ─────────────────────────────────────────────────────────

type SubmissionStatus = "draft" | "submitted" | "scored" | "finalized" | "returned" | null;

const STATUS_CONFIG: Record<NonNullable<SubmissionStatus>, { label: string; className: string; dot: string }> = {
  draft:     { label: "Draft",     className: "bg-surface-sunken text-ink-600 border-line", dot: "bg-ink-400" },
  submitted: { label: "Submitted", className: "bg-accent-50 text-accent-700 border-accent-200", dot: "bg-accent-500" },
  scored:    { label: "Scored",    className: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  finalized: { label: "Finalized", className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  returned:  { label: "Returned",  className: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
};

export function KpiStatusBadge({ status }: { status: SubmissionStatus }) {
  if (!status) return <span className="text-xs text-ink-400 font-mono">Not started</span>;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold font-mono ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Assignment Status Badge ──────────────────────────────────────────────────

type AssignmentStatus = "draft" | "pending_approval" | "active" | "rejected" | null;

export function KpiAssignmentBadge({ status }: { status: AssignmentStatus }) {
  const cfg: Record<NonNullable<AssignmentStatus>, { label: string; className: string; dot: string }> = {
    draft:            { label: "Draft",            className: "bg-surface-sunken text-ink-600 border-line", dot: "bg-ink-400" },
    pending_approval: { label: "Awaiting Approval", className: "bg-accent-50 text-accent-700 border-accent-200", dot: "bg-accent-500" },
    active:           { label: "Active",            className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    rejected:         { label: "Returned",          className: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  };
  if (!status) return <span className="text-xs text-ink-400 font-mono">Not Set Up</span>;
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold font-mono ${c.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─── KRA Attainment Bar ───────────────────────────────────────────────────────

interface KraAttainmentBarProps {
  kraName: string;
  attainmentPct: number | null;
  section?: string;
  weight?: number;
}

export function KraAttainmentBar({ kraName, attainmentPct, section, weight }: KraAttainmentBarProps) {
  const band = getBand(attainmentPct);
  const pct = Math.max(0, Math.min(100, attainmentPct ?? 0));

  return (
    <div className="bg-white rounded-xl p-3.5 border border-line hover:border-accent-200 transition-colors shadow-2xs space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-ink-800">{kraName}</span>
          {weight && (
            <span className="px-1.5 py-0.2 text-[9px] font-bold font-mono uppercase rounded bg-surface-sunken border border-line text-ink-500">
              {weight}%
            </span>
          )}
        </div>
        <span
          className={`text-xs font-bold font-mono tabular-nums shrink-0 ${band?.accentClass ?? "text-ink-400"}`}
        >
          {attainmentPct !== null ? `${attainmentPct.toFixed(0)}%` : "—"}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-sunken border border-line/60">
        {/* Bar fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${band?.barClass ?? "bg-ink-300"}`}
          style={{ width: `${pct}%` }}
        />
        {/* Pass threshold marker at 60% */}
        <div
          className="absolute inset-y-0 w-0.5 bg-ink-900/30 z-10"
          style={{ left: `${PASS_THRESHOLD}%` }}
          title={`Benchmark threshold: ${PASS_THRESHOLD}%`}
        />
      </div>
      {section && (
        <div className="flex items-center justify-between text-[10px] text-ink-400 font-mono">
          <span>{section}</span>
          <span>Target: 100%</span>
        </div>
      )}
    </div>
  );
}

// ─── Score Trend Chart (Zoho SVG Line Chart) ───────────────────────────────────

interface TrendPoint {
  month: string;
  score: number | null;
}

interface ScoreTrendChartProps {
  points: TrendPoint[];
  height?: number;
}

export function ScoreTrendChart({ points, height = 200 }: ScoreTrendChartProps) {
  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-ink-400 font-mono h-40">
        No assessment data yet
      </div>
    );
  }

  const validPoints = points.filter((p) => p.score !== null);
  if (validPoints.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-ink-400 font-mono h-40">
        No scored months yet
      </div>
    );
  }

  const W = 640;
  const H = height;
  const PAD = { top: 20, right: 24, bottom: 36, left: 44 };
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
  const areaParts: string[] = [];
  let inPath = false;
  let lastValidX = 0;

  for (let i = 0; i < points.length; i++) {
    const yVal = ys[i];
    if (yVal === null) { inPath = false; continue; }
    if (!inPath) {
      pathParts.push(`M ${xs[i].toFixed(1)} ${yVal.toFixed(1)}`);
      areaParts.push(`M ${xs[i].toFixed(1)} ${(PAD.top + chartH).toFixed(1)}`);
      areaParts.push(`L ${xs[i].toFixed(1)} ${yVal.toFixed(1)}`);
      inPath = true;
    } else {
      pathParts.push(`L ${xs[i].toFixed(1)} ${yVal.toFixed(1)}`);
      areaParts.push(`L ${xs[i].toFixed(1)} ${yVal.toFixed(1)}`);
    }
    lastValidX = xs[i];
  }
  areaParts.push(`L ${lastValidX.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`);

  const pathD = pathParts.join(" ");
  const areaD = areaParts.join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[500px]"
        style={{ height }}
        aria-label="Score trend chart"
      >
        <defs>
          <linearGradient id="zohoTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4338CA" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4338CA" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Benchmark Grid lines */}
        {[100, 80, 60, 40].map((v) => {
          const y = PAD.top + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#E7E5E1"
                strokeWidth="1"
                strokeDasharray={v === 60 ? "0" : "3 3"}
              />
              <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#888E99" fontFamily="IBM Plex Mono">
                {v}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#zohoTrendGrad)" />

        {/* Score line */}
        <path
          d={pathD}
          fill="none"
          stroke="#4338CA"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => {
          if (ys[i] === null) return null;
          const band = getBand(p.score);
          return (
            <g key={i} className="cursor-pointer group">
              <circle
                cx={xs[i]}
                cy={ys[i]}
                r="5.5"
                fill={band?.hex.base ?? "#4338CA"}
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              <title>{`${p.month}: ${p.score?.toFixed(1)} pts (${band?.label})`}</title>
            </g>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, i) => {
          const label = p.month.split("-")[0];
          return (
            <text
              key={i}
              x={xs[i]}
              y={H - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#525866"
              fontFamily="IBM Plex Mono"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Score Hero Card (Zoho Executive Banner) ───────────────────────────────────

interface ScoreHeroProps {
  title: string;
  subtitle?: string;
  score: number | null | undefined;
  scoreLabel?: string;
  children?: React.ReactNode;
}

export function ScoreHero({ title, subtitle, score, scoreLabel = "Year Average", children }: ScoreHeroProps) {
  const band = getBand(score);
  const pct = Math.max(0, Math.min(100, score ?? 0));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#312E81] bg-gradient-to-br from-[#1E1B4B] via-[#2E286E] to-[#1E1B4B] text-white shadow-md p-6 sm:p-7">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-200 border border-white/10 mb-2.5">
            <Target className="w-3 h-3 text-indigo-300" />
            Executive Performance Overview
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-white/65 font-mono">{subtitle}</p>}
        </div>

        {score !== null && score !== undefined && band ? (
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-200">{scoreLabel}</p>
            <p className="mt-0.5 tabular-nums font-black font-mono leading-none text-4xl sm:text-5xl text-white">
              {score.toFixed(1)}
              <span className="ml-1.5 text-base font-normal text-white/40">/100</span>
            </p>
            <div className="mt-2 inline-block">
              <ScoreBadge score={score} size="md" />
            </div>
          </div>
        ) : (
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40">{scoreLabel}</p>
            <p className="mt-0.5 text-4xl font-black font-mono leading-none text-white/20">—</p>
            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/50 border border-white/10">
              Not Scored Yet
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative mt-6 pt-5 border-t border-white/10">
        <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
          {band && (
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r from-indigo-400 to-emerald-400"
              style={{ width: `${pct}%` }}
            />
          )}
          {/* Band dividers */}
          {[40, 60, 80, 90].map((v) => (
            <span
              key={v}
              className="absolute inset-y-0 w-px bg-white/25"
              style={{ left: `${v}%` }}
            />
          ))}
        </div>

        {/* Band labels */}
        <div className="mt-2.5 flex justify-between text-[9px] font-mono font-bold uppercase tracking-wider text-white/40">
          <span>Needs Focus (&lt;40)</span>
          <span>Satisfactory (40-59)</span>
          <span>Good (60-79)</span>
          <span>Very Good (80-89)</span>
          <span>Outstanding (90+)</span>
        </div>
      </div>

      {children && (
        <div className="relative mt-4 pt-4 border-t border-white/10">{children}</div>
      )}
    </section>
  );
}

// ─── Stat Card (Zoho Financial-Grade KPI Card) ─────────────────────────────────

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose";
}

export function StatCard({ label, value, sub, icon, accent = "indigo" }: StatCardProps) {
  const accentBorder = {
    indigo: "border-l-indigo-600",
    emerald: "border-l-emerald-600",
    amber: "border-l-amber-500",
    rose: "border-l-rose-500",
  }[accent];

  return (
    <div className={`bg-white border border-line rounded-xl p-4.5 transition-all shadow-[0_10px_30px_-5px_rgba(30,27,75,0.02)] border-l-4 ${accentBorder} hover:shadow-xs`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono font-bold text-ink-500 uppercase tracking-wider m-0">{label}</p>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-ink-900 tabular-nums leading-tight">{value}</div>
      {sub && <p className="mt-1.5 text-[11px] font-sans text-ink-400 m-0">{sub}</p>}
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
  const borderBg = variant === "danger" 
    ? "bg-rose-50 border-rose-200 text-rose-900" 
    : variant === "warning" 
    ? "bg-amber-50 border-amber-200 text-amber-900" 
    : "bg-indigo-50 border-indigo-200 text-indigo-900";

  const btnBg = variant === "danger"
    ? "bg-rose-600 hover:bg-rose-700 text-white"
    : variant === "warning"
    ? "bg-amber-600 hover:bg-amber-700 text-white"
    : "bg-indigo-600 hover:bg-indigo-700 text-white";

  return (
    <div className={`relative overflow-hidden rounded-xl border p-4.5 ${borderBg} shadow-2xs`}>
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="relative mt-1 flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80 m-0">{eyebrow}</p>
            <p className="mt-0.5 text-sm font-bold m-0 text-current">{title}</p>
            {body && <div className="mt-1 text-xs opacity-85 font-sans leading-relaxed">{body}</div>}
          </div>
        </div>
        <button
          onClick={onClick}
          className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer ${btnBg}`}
        >
          {cta} →
        </button>
      </div>
    </div>
  );
}
