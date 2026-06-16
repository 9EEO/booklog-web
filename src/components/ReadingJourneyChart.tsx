import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ReadingRecord } from "../types/reading";
import { formatDuration } from "../utils/formatDuration";

type ReadingJourneyChartProps = {
  records: ReadingRecord[];
  totalPages: number | null;
  variant?: "default" | "completeReport";
};

type JourneyPoint = {
  date: string;
  startPage: number;
  endPage: number;
  readPages: number;
  durationSeconds: number;
  recordCount: number;
  x: number;
  y: number;
};

type JourneyPointStyle = CSSProperties & {
  "--journey-x": string;
  "--journey-y": string;
  "--journey-point-size": string;
  "--journey-delay": string;
};

type ChartLayout = {
  width: number;
  height: number;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
};

type JourneySvgLabel = {
  key: string;
  title: string;
  subtitle: string;
  meta: string;
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
};

const defaultChartLayout: ChartLayout = {
  width: 320,
  height: 148,
  paddingX: 18,
  paddingTop: 18,
  paddingBottom: 24,
};

const completeChartLayout: ChartLayout = {
  width: 320,
  height: 176,
  paddingX: 18,
  paddingTop: 52,
  paddingBottom: 28,
};

const toDateTime = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split(".").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const formatShortDate = (dateLabel: string) => {
  const [, month, day] = dateLabel.split(".");

  return month && day ? `${month}.${day}` : dateLabel;
};

const formatCompactDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }

  return `${Math.max(minutes, 1)}분`;
};

const createJourneyPoints = (
  records: ReadingRecord[],
  totalPages: number | null,
  layout: ChartLayout,
) => {
  const recordsByDate = new Map<string, ReadingRecord[]>();

  [...records]
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.startedAt ?? "").localeCompare(right.startedAt ?? "") ||
        left.id.localeCompare(right.id),
    )
    .forEach((record) => {
      const dateRecords = recordsByDate.get(record.date) ?? [];
      dateRecords.push(record);
      recordsByDate.set(record.date, dateRecords);
    });

  const dailyPoints = [...recordsByDate.entries()].map(
    ([date, dateRecords]) => ({
      date,
      startPage: dateRecords[0].startPage,
      endPage: dateRecords.at(-1)?.endPage ?? dateRecords[0].endPage,
      readPages: dateRecords.reduce(
        (sum, record) =>
          sum + Math.max(record.endPage - record.startPage + 1, 0),
        0,
      ),
      durationSeconds: dateRecords.reduce(
        (sum, record) => sum + record.durationSeconds,
        0,
      ),
      recordCount: dateRecords.length,
    }),
  );
  const firstTime = toDateTime(dailyPoints[0]?.date ?? "");
  const lastTime = toDateTime(dailyPoints.at(-1)?.date ?? "");
  const timeRange = Math.max(lastTime - firstTime, 1);
  const maxPage = Math.max(
    totalPages ?? 0,
    ...dailyPoints.map((point) => point.endPage),
    1,
  );
  const plotWidth = layout.width - layout.paddingX * 2;
  const plotHeight = layout.height - layout.paddingTop - layout.paddingBottom;

  return dailyPoints.map((point): JourneyPoint => {
    const xRatio =
      dailyPoints.length === 1
        ? 0.5
        : (toDateTime(point.date) - firstTime) / timeRange;
    const yRatio = Math.min(Math.max(point.endPage / maxPage, 0), 1);

    return {
      ...point,
      x: layout.paddingX + plotWidth * xRatio,
      y: layout.paddingTop + plotHeight * (1 - yRatio),
    };
  });
};

const createSvgLabel = (
  point: JourneyPoint,
  layout: ChartLayout,
  label: Omit<JourneySvgLabel, "x" | "y">,
): JourneySvgLabel => {
  const labelGap = 10;
  const edgePadding = 8;
  const x =
    point.x > layout.width * 0.58
      ? Math.max(edgePadding, point.x - label.width - labelGap)
      : Math.min(layout.width - label.width - edgePadding, point.x + labelGap);
  const canFitAbove = point.y - label.height - labelGap >= edgePadding;
  const preferredY = canFitAbove
    ? point.y - label.height - labelGap
    : point.y + labelGap;
  const y = Math.max(
    edgePadding,
    Math.min(
      preferredY,
      layout.height - layout.paddingBottom - label.height - edgePadding,
    ),
  );

  return {
    ...label,
    x,
    y,
  };
};

export const ReadingJourneyChart = ({
  records,
  totalPages,
  variant = "default",
}: ReadingJourneyChartProps) => {
  const chartLayout =
    variant === "completeReport" ? completeChartLayout : defaultChartLayout;
  const points = useMemo(
    () => createJourneyPoints(records, totalPages, chartLayout),
    [chartLayout, records, totalPages],
  );
  const [selectedDate, setSelectedDate] = useState(
    () => points.at(-1)?.date ?? "",
  );
  const [isAnimated, setIsAnimated] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const selectedPoint =
    points.find((point) => point.date === selectedDate) ?? points.at(-1);
  const lastPoint = points.at(-1);
  const showInlineLabels = variant === "completeReport";
  const maxDuration = Math.max(
    ...points.map((point) => point.durationSeconds),
    1,
  );
  const pathData = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  const areaData = points.length
    ? `${pathData} L ${points.at(-1)?.x.toFixed(2)} ${chartLayout.height - chartLayout.paddingBottom} L ${points[0].x.toFixed(2)} ${chartLayout.height - chartLayout.paddingBottom} Z`
    : "";
  const svgLabels: JourneySvgLabel[] = showInlineLabels && selectedPoint
    ? [
        createSvgLabel(selectedPoint, chartLayout, {
          key: selectedPoint.date,
          title:
            selectedPoint.date === lastPoint?.date
              ? `${formatShortDate(selectedPoint.date)} · 완독`
              : formatShortDate(selectedPoint.date),
          subtitle: `${selectedPoint.startPage}p → ${selectedPoint.endPage}p`,
          meta: `${formatCompactDuration(selectedPoint.durationSeconds)} · ${selectedPoint.recordCount}회`,
          width: 104,
          height: 46,
          className: "book-journey-svg-label-selected",
        }),
      ]
    : [];

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || isAnimated) return;
    if (!("IntersectionObserver" in window)) {
      const animationFrame = globalThis.requestAnimationFrame(() =>
        setIsAnimated(true),
      );

      return () => globalThis.cancelAnimationFrame(animationFrame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        setIsAnimated(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(chart);

    return () => observer.disconnect();
  }, [isAnimated]);

  if (points.length === 0) {
    return (
      <p className="book-journey-empty">
        독서 기록이 쌓이면 페이지 흐름을 차트로 보여드려요.
      </p>
    );
  }

  return (
    <div
      ref={chartRef}
      className={`book-journey-chart ${
        isAnimated ? "book-journey-chart-active" : ""
      } ${showInlineLabels ? "book-journey-chart-complete" : ""}`}
      onFocusCapture={() => setIsAnimated(true)}
    >
      <div className="book-journey-plot">
        <svg
          viewBox={`0 0 ${chartLayout.width} ${chartLayout.height}`}
          role="img"
          aria-label="날짜별 독서 페이지 추이"
        >
          <title>날짜별 독서 페이지 추이</title>
          {[0, 1, 2].map((line) => {
            const y =
              chartLayout.paddingTop +
              ((chartLayout.height -
                chartLayout.paddingTop -
                chartLayout.paddingBottom) /
                2) *
                line;

            return (
              <line
                key={line}
                className="book-journey-grid-line"
                x1={chartLayout.paddingX}
                x2={chartLayout.width - chartLayout.paddingX}
                y1={y}
                y2={y}
              />
            );
          })}
          {areaData && (
            <path className="book-journey-area" d={areaData} pathLength="1" />
          )}
          {pathData && (
            <path className="book-journey-line" d={pathData} pathLength="1" />
          )}
          {svgLabels.map((label) => (
            <g
              key={label.key}
              className={`book-journey-svg-label ${label.className}`}
              transform={`translate(${label.x.toFixed(2)} ${label.y.toFixed(2)})`}
            >
              <rect width={label.width} height={label.height} rx="13" />
              <text className="book-journey-svg-label-title" x="10" y="14">
                {label.title}
              </text>
              <text className="book-journey-svg-label-subtitle" x="10" y="27">
                {label.subtitle}
              </text>
              <text className="book-journey-svg-label-meta" x="10" y="39">
                {label.meta}
              </text>
            </g>
          ))}
        </svg>

        {points.map((point, index) => {
          const pointSize = 10 + (point.durationSeconds / maxDuration) * 6;
          const style: JourneyPointStyle = {
            "--journey-x": `${(point.x / chartLayout.width) * 100}%`,
            "--journey-y": `${(point.y / chartLayout.height) * 100}%`,
            "--journey-point-size": `${pointSize}px`,
            "--journey-delay": `${Math.min(300 + index * 90, 900)}ms`,
          };

          return (
            <button
              key={point.date}
              type="button"
              className={`book-journey-point ${
                point.date === selectedPoint?.date
                  ? "book-journey-point-active"
                  : ""
              }`}
              style={style}
              onClick={() => setSelectedDate(point.date)}
              aria-label={`${point.date}, ${point.endPage}페이지, ${formatDuration(point.durationSeconds)}`}
              aria-pressed={point.date === selectedPoint?.date}
            />
          );
        })}

        <span className="book-journey-axis-label book-journey-axis-label-start">
          {formatShortDate(points[0].date)}
        </span>
        <span className="book-journey-axis-label book-journey-axis-label-end">
          {formatShortDate(points.at(-1)?.date ?? "")}
        </span>
      </div>

      {selectedPoint && (
        <div className="book-journey-detail" aria-live="polite">
          <div>
            <span>{selectedPoint.date}</span>
            <strong>
              {selectedPoint.startPage}p → {selectedPoint.endPage}p
            </strong>
          </div>
          <div>
            <span>읽은 시간</span>
            <strong>{formatDuration(selectedPoint.durationSeconds)}</strong>
          </div>
          <div>
            <span>기록</span>
            <strong>{selectedPoint.recordCount}회</strong>
          </div>
        </div>
      )}
    </div>
  );
};
