import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

export type SwipeSegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SwipeSegmentedControlProps<T extends string> = {
  options: readonly SwipeSegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  renderOption?: (
    option: SwipeSegmentedControlOption<T>,
    isActive: boolean,
  ) => ReactNode;
};

type SwipeSegmentedStyle = CSSProperties & {
  "--swipe-segment-count": number;
  "--swipe-segment-width": string;
  "--swipe-segment-translate": string;
  "--swipe-segment-drag-offset": string;
};

const findEnabledIndex = <T extends string>(
  options: readonly SwipeSegmentedControlOption<T>[],
  startIndex: number,
  direction: -1 | 1,
) => {
  for (
    let index = startIndex + direction;
    index >= 0 && index < options.length;
    index += direction
  ) {
    if (!options[index].disabled) return index;
  }

  return startIndex;
};

export const SwipeSegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
  renderOption,
}: SwipeSegmentedControlProps<T>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; pointerId: number } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  const moveToIndex = (index: number) => {
    const nextOption = options[index];
    if (!nextOption || nextOption.disabled || nextOption.value === value)
      return;

    onChange(nextOption.value);
  };

  const moveBy = (direction: -1 | 1) => {
    moveToIndex(findEnabledIndex(options, activeIndex, direction));
  };

  const resetDrag = () => {
    dragStartRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragStartRef.current = {
      x: event.clientX,
      pointerId: event.pointerId,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    const root = rootRef.current;
    if (!dragStart || !root) return;

    const segmentWidth = root.getBoundingClientRect().width / options.length;
    const nextOffset = Math.max(
      Math.min(event.clientX - dragStart.x, segmentWidth),
      -segmentWidth,
    );

    if (Math.abs(nextOffset) > 8) suppressClickRef.current = true;
    setDragOffset(nextOffset);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    const root = rootRef.current;
    if (!dragStart || !root) {
      resetDrag();
      return;
    }

    if (event.currentTarget.hasPointerCapture(dragStart.pointerId)) {
      event.currentTarget.releasePointerCapture(dragStart.pointerId);
    }

    const segmentWidth = root.getBoundingClientRect().width / options.length;
    const threshold = Math.min(80, Math.max(32, segmentWidth * 0.32));
    const distance = event.clientX - dragStart.x;

    if (distance <= -threshold) moveBy(1);
    if (distance >= threshold) moveBy(-1);
    resetDrag();
  };

  const handleClickCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveToIndex(findEnabledIndex(options, -1, 1));
    }
    if (event.key === "End") {
      event.preventDefault();
      moveToIndex(findEnabledIndex(options, options.length, -1));
    }
  };

  const style: SwipeSegmentedStyle = {
    "--swipe-segment-count": options.length,
    "--swipe-segment-width": `calc((100% - 6px) / ${options.length})`,
    "--swipe-segment-translate": `${activeIndex * 100}%`,
    "--swipe-segment-drag-offset": `${dragOffset}px`,
  };

  return (
    <div
      ref={rootRef}
      className={`swipe-segmented-control ${isDragging ? "swipe-segmented-control-dragging" : ""} ${className}`}
      style={style}
      role="tablist"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={resetDrag}
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
    >
      <span className="swipe-segmented-indicator" aria-hidden="true" />
      {options.map((option, index) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            className={`swipe-segmented-option ${isActive ? "swipe-segmented-option-active" : ""}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {renderOption ? renderOption(option, isActive) : option.label}
            <span className="sr-only">{index + 1}번째 보기</span>
          </button>
        );
      })}
    </div>
  );
};
