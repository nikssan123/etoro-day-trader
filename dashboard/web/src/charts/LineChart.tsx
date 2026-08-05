import { useMemo, useState } from 'react';
import { useSize } from './useSize';

export interface Series {
  key: string;
  label: string;
  color: string;
  /** Draw recessive: context series behind the one the chart is about. */
  muted?: boolean;
}

interface Props {
  points: Record<string, number | string>[];
  xKey: string;
  series: Series[];
  height?: number;
  /** Horizontal reference line (100 for an indexed chart, 0 for expectancy). */
  baselineValue?: number;
  baselineLabel?: string;
  format?: (v: number) => string;
  yLabel?: string;
}

const PAD = { top: 12, right: 76, bottom: 26, left: 48 };
const MIN_LABEL_GAP = 14;

export function LineChart({
  points, xKey, series, height = 260, baselineValue, baselineLabel, format, yLabel,
}: Props) {
  const { ref, width } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = format ?? ((v: number) => v.toFixed(1));

  const geom = useMemo(() => {
    if (width === 0 || points.length === 0) return null;

    const values: number[] = [];
    for (const p of points) {
      for (const s of series) {
        const v = p[s.key];
        if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
      }
    }
    if (baselineValue !== undefined) values.push(baselineValue);
    if (values.length === 0) return null;

    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const headroom = (max - min) * 0.08;
    min -= headroom;
    max += headroom;

    const plotW = Math.max(width - PAD.left - PAD.right, 10);
    const plotH = height - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;

    // Clean-ish tick values across the range.
    const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

    return { x, y, min, max, plotW, plotH, ticks };
  }, [width, points, series, height, baselineValue]);

  // End labels: nudge apart when series converge, and draw a leader line back to the
  // series end so a moved label stays attached to its line.
  const endLabels = useMemo(() => {
    if (!geom || points.length === 0) return [];
    const last = points[points.length - 1]!;
    const raw = series
      .map((s) => {
        const v = last[s.key];
        return typeof v === 'number' && Number.isFinite(v)
          ? { s, value: v, trueY: geom.y(v), y: geom.y(v) }
          : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.y - b.y);

    for (let i = 1; i < raw.length; i += 1) {
      const prev = raw[i - 1]!;
      const cur = raw[i]!;
      if (cur.y - prev.y < MIN_LABEL_GAP) cur.y = prev.y + MIN_LABEL_GAP;
    }
    return raw;
  }, [geom, points, series]);

  if (points.length === 0) {
    return <div className="empty">No data yet — this fills in as cycles run.</div>;
  }

  const hoverPoint = hover !== null ? points[hover] : undefined;

  return (
    <div className="chart-holder" ref={ref}>
      {/* Legend is the dependable identity channel and is always present for >= 2 series. */}
      {series.length > 1 && (
        <ul className="legend">
          {series.map((s) => (
            <li key={s.key}>
              <span className="swatch" style={{ background: s.color, opacity: s.muted ? 0.55 : 1 }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {geom && width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={yLabel ?? 'line chart'}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const rel = e.clientX - rect.left - PAD.left;
            const idx = Math.round((rel / geom.plotW) * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, idx)));
          }}
        >
          {/* Gridlines: hairline, solid, recessive. */}
          {geom.ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left} x2={width - PAD.right} y1={geom.y(t)} y2={geom.y(t)}
                stroke="var(--gridline)" strokeWidth={1}
              />
              <text
                x={PAD.left - 8} y={geom.y(t) + 4} textAnchor="end"
                fill="var(--text-muted)" fontSize={11}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmt(t)}
              </text>
            </g>
          ))}

          {baselineValue !== undefined && (
            <>
              <line
                x1={PAD.left} x2={width - PAD.right}
                y1={geom.y(baselineValue)} y2={geom.y(baselineValue)}
                stroke="var(--baseline)" strokeWidth={1}
              />
              {baselineLabel && (
                <text
                  x={PAD.left + 4} y={geom.y(baselineValue) - 5}
                  fill="var(--text-muted)" fontSize={11}
                >
                  {baselineLabel}
                </text>
              )}
            </>
          )}

          {hover !== null && (
            <line
              x1={geom.x(hover)} x2={geom.x(hover)} y1={PAD.top} y2={height - PAD.bottom}
              stroke="var(--baseline)" strokeWidth={1}
            />
          )}

          {series.map((s) => {
            const d = points
              .map((p, i) => {
                const v = p[s.key];
                if (typeof v !== 'number' || !Number.isFinite(v)) return null;
                return `${i === 0 ? 'M' : 'L'}${geom.x(i)},${geom.y(v)}`;
              })
              .filter(Boolean)
              .join(' ')
              .replace(/^L/, 'M');
            return (
              <path
                key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" opacity={s.muted ? 0.5 : 1}
              />
            );
          })}

          {/* End markers: r >= 4 with a 2px surface ring so they stay legible on crossings. */}
          {endLabels.map((d) => (
            <circle
              key={d.s.key} cx={geom.x(points.length - 1)} cy={d.trueY} r={4}
              fill={d.s.color} stroke="var(--surface-1)" strokeWidth={2}
              opacity={d.s.muted ? 0.6 : 1}
            />
          ))}

          {/* Direct end labels + leader lines. Text wears text tokens; the colored dot
              beside it carries identity. */}
          {endLabels.map((d) => (
            <g key={`lbl-${d.s.key}`}>
              {Math.abs(d.y - d.trueY) > 1 && (
                <line
                  x1={geom.x(points.length - 1) + 5} y1={d.trueY}
                  x2={width - PAD.right + 10} y2={d.y}
                  stroke="var(--gridline)" strokeWidth={1}
                />
              )}
              <circle
                cx={width - PAD.right + 14} cy={d.y - 3} r={3}
                fill={d.s.color} opacity={d.s.muted ? 0.6 : 1}
              />
              <text
                x={width - PAD.right + 21} y={d.y} fill="var(--text-secondary)" fontSize={11}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmt(d.value)}
              </text>
            </g>
          ))}

          {hover !== null && series.map((s) => {
            const v = points[hover]![s.key];
            if (typeof v !== 'number' || !Number.isFinite(v)) return null;
            return (
              <circle
                key={`h-${s.key}`} cx={geom.x(hover)} cy={geom.y(v)} r={4}
                fill={s.color} stroke="var(--surface-1)" strokeWidth={2}
              />
            );
          })}
        </svg>
      )}

      {hover !== null && hoverPoint && geom && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(geom.x(hover) - 60, 0), Math.max(width - 150, 0)),
            top: 4,
          }}
        >
          <div className="muted" style={{ marginBottom: 4 }}>
            {String(hoverPoint[xKey] ?? '').slice(0, 10)}
          </div>
          {series.map((s) => {
            const v = hoverPoint[s.key];
            if (typeof v !== 'number' || !Number.isFinite(v)) return null;
            return (
              <div className="row" key={s.key}>
                <span>
                  <span
                    className="swatch"
                    style={{ background: s.color, display: 'inline-block', marginRight: 6 }}
                  />
                  {s.label}
                </span>
                <span>{fmt(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
