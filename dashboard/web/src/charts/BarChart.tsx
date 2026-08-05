import { useMemo, useState } from 'react';
import { useSize } from './useSize';

export interface Bar {
  label: string;
  value: number;
  /** Shown in the tooltip — e.g. sample size and tier. */
  note?: string;
}

interface Props {
  bars: Bar[];
  height?: number;
  /** Diverging: values straddle zero, so the baseline sits inside the plot and the
   *  two arms take opposite hues. Otherwise one sequential hue. */
  diverging?: boolean;
  format?: (v: number) => string;
  labelWidth?: number;
}

const BAR_MAX = 24;
const GAP = 2;
const PAD = { top: 6, right: 56, bottom: 20 };

export function BarChart({
  bars, height, diverging = false, format, labelWidth = 116,
}: Props) {
  const { ref, width } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = format ?? ((v: number) => v.toFixed(2));

  const rowH = 30;
  const chartH = height ?? PAD.top + PAD.bottom + bars.length * rowH;

  const geom = useMemo(() => {
    if (width === 0 || bars.length === 0) return null;
    const plotW = Math.max(width - labelWidth - PAD.right, 10);
    const values = bars.map((b) => b.value);
    const maxAbs = Math.max(...values.map(Math.abs), 0.0001);
    const min = diverging ? -maxAbs : Math.min(0, ...values);
    const max = maxAbs;
    const x = (v: number) => labelWidth + ((v - min) / (max - min)) * plotW;
    return { x, zero: x(0), plotW };
  }, [width, bars, diverging, labelWidth]);

  if (bars.length === 0) {
    return <div className="empty">No data yet — this fills in once trades close.</div>;
  }

  return (
    <div className="chart-holder" ref={ref}>
      {geom && width > 0 && (
        <svg width={width} height={chartH} role="img">
          {/* Baseline: bars grow from a single origin. */}
          <line
            x1={geom.zero} x2={geom.zero} y1={PAD.top} y2={chartH - PAD.bottom}
            stroke="var(--baseline)" strokeWidth={1}
          />

          {bars.map((bar, i) => {
            const barH = Math.min(BAR_MAX, rowH - 8);
            const y = PAD.top + i * rowH + (rowH - barH) / 2;
            const end = geom.x(bar.value);
            const negative = bar.value < 0;
            // 4px rounded data-end, square at the baseline. Drawn as a path so only
            // the growing end is rounded; a plain rect would round all four corners.
            const x0 = negative ? end : geom.zero + GAP / 2;
            const x1 = negative ? geom.zero - GAP / 2 : end;
            const w = Math.max(x1 - x0, 1);
            const r = Math.min(4, w);
            const d = negative
              ? `M${x1},${y} H${x0 + r} Q${x0},${y} ${x0},${y + r} V${y + barH - r} Q${x0},${y + barH} ${x0 + r},${y + barH} H${x1} Z`
              : `M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + barH - r} Q${x1},${y + barH} ${x1 - r},${y + barH} H${x0} Z`;

            const color = diverging
              ? (negative ? 'var(--critical)' : 'var(--series-1)')
              : 'var(--series-1)';

            return (
              <g
                key={bar.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {/* Full-row hit target: bigger than the mark, per the interaction spec. */}
                <rect
                  x={0} y={PAD.top + i * rowH} width={width} height={rowH}
                  fill="transparent"
                />
                <text
                  x={labelWidth - 10} y={y + barH / 2 + 4} textAnchor="end"
                  fill="var(--text-secondary)" fontSize={12}
                >
                  {bar.label.length > 18 ? `${bar.label.slice(0, 17)}…` : bar.label}
                </text>
                <path d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
                {/* Value at the tip, outside the bar so it is never clipped. */}
                <text
                  x={negative ? end - 6 : end + 6}
                  y={y + barH / 2 + 4}
                  textAnchor={negative ? 'end' : 'start'}
                  fill="var(--text-secondary)" fontSize={11}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(bar.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {hover !== null && bars[hover]?.note && (
        <div className="chart-tooltip" style={{ left: 12, top: PAD.top + hover * rowH - 34 }}>
          <div className="row">
            <span>{bars[hover]!.label}</span>
          </div>
          <div className="muted">{bars[hover]!.note}</div>
        </div>
      )}
    </div>
  );
}
