import { useState } from 'react';

interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  centerText?: string;
  centerSubText?: string;
  size?: number;
}

export default function DonutChart({
  data,
  centerText,
  centerSubText,
  size = 200,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 20}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={size * 0.15}
          />
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-400 text-sm"
          >
            데이터 없음
          </text>
        </svg>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.15;
  const radius = size / 2 - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * radius;

  // Build segments
  let accumulated = 0;
  const segments = data.map((d, i) => {
    const ratio = d.value / total;
    const dashLength = ratio * circumference;
    const gapLength = circumference - dashLength;
    const offset = -accumulated * circumference + circumference * 0.25; // start from top
    accumulated += ratio;

    return {
      ...d,
      index: i,
      dashArray: `${dashLength} ${gapLength}`,
      dashOffset: offset,
      ratio,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Chart */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {segments.map((seg) => (
          <circle
            key={seg.index}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"
            className="transition-transform duration-200 origin-center"
            style={{
              transform: hoveredIndex === seg.index ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: `${cx}px ${cy}px`,
              cursor: 'pointer',
              opacity: hoveredIndex !== null && hoveredIndex !== seg.index ? 0.5 : 1,
              transition: 'transform 0.2s ease, opacity 0.2s ease',
            }}
            onMouseEnter={() => setHoveredIndex(seg.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* Center text */}
        {centerText && (
          <text
            x={cx}
            y={centerSubText ? cy - 6 : cy}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-900 font-bold"
            style={{ fontSize: size * 0.16 }}
          >
            {centerText}
          </text>
        )}
        {centerSubText && (
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-500"
            style={{ fontSize: size * 0.08 }}
          >
            {centerSubText}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full max-w-[280px]">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-gray-600 truncate">{d.label}</span>
            <span className="ml-auto font-semibold text-gray-900">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
