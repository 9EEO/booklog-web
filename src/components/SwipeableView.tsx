import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

type SwipeableViewOption<T extends string> = {
  value: T;
  disabled?: boolean;
};

type SwipeableViewProps<T extends string> = {
  options: readonly SwipeableViewOption<T>[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

type DragStart = {
  x: number;
  y: number;
  pointerId: number;
  isHorizontal: boolean;
  isVertical: boolean;
};

type SwipeableViewStyle = CSSProperties & {
  "--swipe-view-drag-offset": string;
  "--swipe-view-drag-progress": number;
};

const ignoredSwipeTargetSelector =
  'input, select, textarea, [contenteditable="true"], [data-swipe-ignore="true"]';

const findEnabledIndex = <T extends string>(
  options: readonly SwipeableViewOption<T>[],
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

const shouldIgnoreSwipeStart = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest(ignoredSwipeTargetSelector));

export const SwipeableView = <T extends string>({
  options,
  value,
  onChange,
  children,
  className = "",
  ariaLabel,
}: SwipeableViewProps<T>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragRange, setDragRange] = useState(1);
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

  const releasePointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    if (event.currentTarget.hasPointerCapture(dragStart.pointerId)) {
      event.currentTarget.releasePointerCapture(dragStart.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (shouldIgnoreSwipeStart(event.target)) return;

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      isHorizontal: false,
      isVertical: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    const root = rootRef.current;
    if (!dragStart || !root || dragStart.isVertical) return;

    const distanceX = event.clientX - dragStart.x;
    const distanceY = event.clientY - dragStart.y;
    const absoluteX = Math.abs(distanceX);
    const absoluteY = Math.abs(distanceY);

    if (!dragStart.isHorizontal && Math.max(absoluteX, absoluteY) > 8) {
      if (absoluteY > absoluteX * 1.12) {
        dragStart.isVertical = true;
        resetDrag();
        return;
      }

      dragStart.isHorizontal = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (!dragStart.isHorizontal) return;

    const dragLimit = root.getBoundingClientRect().width * 0.28;
    const nextOffset = Math.max(Math.min(distanceX, dragLimit), -dragLimit);

    if (absoluteX > 8) suppressClickRef.current = true;
    setDragRange(Math.max(dragLimit, 1));
    setDragOffset(nextOffset);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    const root = rootRef.current;
    if (!dragStart || !root) {
      resetDrag();
      return;
    }

    releasePointerCapture(event);

    if (dragStart.isHorizontal) {
      const distanceX = event.clientX - dragStart.x;
      const distanceY = event.clientY - dragStart.y;
      const threshold = Math.min(
        110,
        Math.max(44, root.getBoundingClientRect().width * 0.18),
      );

      if (Math.abs(distanceX) > Math.abs(distanceY) * 1.12) {
        if (distanceX <= -threshold) moveBy(1);
        if (distanceX >= threshold) moveBy(-1);
      }
    }

    resetDrag();
  };

  const handleClickCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const dragProgress = Math.min(
    Math.abs(dragOffset) / Math.max(dragRange * 0.78, 1),
    1,
  );
  const style: SwipeableViewStyle = {
    "--swipe-view-drag-offset": `${dragOffset}px`,
    "--swipe-view-drag-progress": dragProgress,
  };

  return (
    <div
      ref={rootRef}
      className={`swipeable-view ${isDragging ? "swipeable-view-dragging" : ""} ${className}`}
      style={style}
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={(event) => {
        releasePointerCapture(event);
        resetDrag();
      }}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
};
