import { useRef, useState, type KeyboardEvent } from 'react';
import { getNaqiVisualTokens } from '../../domain/naqi';
import { getUsAqiVisualTokens, normalizeUsAqiCategoryLabel } from '../../domain/usAqi';
import type { AqiScale, HourlyForecastPoint, NaqiCategory, UsAqiCategory } from '../../types/breathewise';

interface HourlyTrendChartProps {
  points: HourlyForecastPoint[];
  scale?: AqiScale;
  caption?: string;
}

export function HourlyTrendChart({
  points,
  scale = 'US_AQI',
  caption,
}: HourlyTrendChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(Math.min(6, Math.max(0, points.length - 1)));
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState<boolean>(false);
  const pointRefs = useRef<Array<SVGCircleElement | null>>([]);

  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-600 py-8 text-center">
        No hourly trend points available for the active state.
      </p>
    );
  }

  const clampedIdx = Math.min(selectedIdx, points.length - 1);

  const width = 680;
  const height = 210;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxY = Math.max(300, ...points.map((p) => p.estimatedNaqi + 30));
  const yMaxCeil = Math.min(500, Math.ceil(maxY / 50) * 50);

  const coords = points.map((pt, i) => {
    const x = padLeft + (i / Math.max(1, points.length - 1)) * chartW;
    const y = padTop + chartH - (pt.estimatedNaqi / yMaxCeil) * chartH;
    return { x, y, pt };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  const active = coords[clampedIdx] ?? coords[0];
  const isUs = scale === 'US_AQI' || normalizeUsAqiCategoryLabel(active.pt.category) !== null;
  const activeTokens = isUs
    ? getUsAqiVisualTokens(
        (normalizeUsAqiCategoryLabel(active.pt.category) ?? 'Unavailable') as
          | UsAqiCategory
          | 'Unavailable',
      )
    : getNaqiVisualTokens(active.pt.category as NaqiCategory);

  const scaleLabel = isUs ? 'US AQI' : 'NAQI';
  const gridLevels = [100, 200, 300, 400].filter((v) => v <= yMaxCeil);

  const handlePointKeyDown = (e: KeyboardEvent<SVGCircleElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIdx = Math.min(coords.length - 1, idx + 1);
    } else if (e.key === 'ArrowLeft') {
      nextIdx = Math.max(0, idx - 1);
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = coords.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedIdx(idx);
      return;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      setSelectedIdx(nextIdx);
      pointRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
        <div className="flex items-center gap-2 font-mono tabular-nums" aria-live="polite">
          <span className="font-semibold text-slate-900">{active.pt.hourLabel}</span>
          <span aria-hidden="true">·</span>
          <span>
            {scaleLabel} {active.pt.estimatedNaqi}
          </span>
          <span aria-hidden="true">·</span>
          <span>PM2.5 {active.pt.pm25} µg/m³</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-semibold ${activeTokens.textClass}`}>{active.pt.category}</span>
          <button
            type="button"
            aria-expanded={showTable}
            onClick={() => setShowTable((prev) => !prev)}
            className="min-h-6 px-2 py-1 inline-flex items-center rounded text-xs font-medium text-teal-800 hover:bg-teal-50 hover:underline cursor-pointer"
          >
            {showTable ? 'Hide data table' : 'Show data table'}
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[460px] h-auto select-none"
          role="group"
          aria-label={`24-hour estimated ${scaleLabel} trend curve across ${points.length} intervals`}
        >
          {gridLevels.map((lvl) => {
            const y = padTop + chartH - (lvl / yMaxCeil) * chartH;
            return (
              <g key={lvl}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-600 text-[10px] font-mono"
                >
                  {lvl}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="#0f766e" fillOpacity={0.08} />
          <path d={linePath} fill="none" stroke="#0f766e" strokeWidth={2.2} strokeLinejoin="round" />

          {coords.map((c, idx) => {
            const isActive = idx === clampedIdx;
            const isFocused = idx === focusedIdx;
            return (
              <g key={`${c.pt.hourLabel}-${idx}`}>
                {isFocused && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={10}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isActive ? 5 : 3.2}
                  fill={isActive ? '#0284c7' : '#0f766e'}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
                <circle
                  ref={(el) => {
                    pointRefs.current[idx] = el;
                  }}
                  cx={c.x}
                  cy={c.y}
                  r={14}
                  fill="transparent"
                  className="cursor-pointer focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`Hour ${c.pt.hourLabel}: ${scaleLabel} ${c.pt.estimatedNaqi}, PM2.5 ${c.pt.pm25} µg/m³, ${c.pt.category}`}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onFocus={() => {
                    setSelectedIdx(idx);
                    setFocusedIdx(idx);
                  }}
                  onBlur={() => setFocusedIdx((prev) => (prev === idx ? null : prev))}
                  onClick={() => setSelectedIdx(idx)}
                  onKeyDown={(e) => handlePointKeyDown(e, idx)}
                />
                {idx % 2 === 0 && (
                  <text
                    x={c.x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-600 text-[10px] font-mono"
                  >
                    {c.pt.hourLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Screen-reader and toggleable accessible hourly data table */}
      <div className={showTable ? 'overflow-x-auto border border-slate-200 rounded-md' : 'sr-only'}>
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">
            Hourly estimated {scaleLabel} and PM2.5 trend data
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <th scope="col" className="py-2 px-3 font-semibold">
                Time
              </th>
              <th scope="col" className="py-2 px-3 font-semibold text-right">
                {scaleLabel}
              </th>
              <th scope="col" className="py-2 px-3 font-semibold text-right">
                PM2.5 (µg/m³)
              </th>
              <th scope="col" className="py-2 px-3 font-semibold">
                Category
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {points.map((pt, idx) => (
              <tr key={`${pt.timestamp}-${idx}`}>
                <td className="py-1.5 px-3 font-mono text-slate-900">{pt.hourLabel}</td>
                <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-900">
                  {pt.estimatedNaqi}
                </td>
                <td className="py-1.5 px-3 font-mono tabular-nums text-right text-slate-800">
                  {pt.pm25}
                </td>
                <td className="py-1.5 px-3 text-slate-700">{pt.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {caption && <p className="text-xs text-slate-600">{caption}</p>}
    </div>
  );
}
