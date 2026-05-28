import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PixelCard } from "../components/PixelCard";
import type { Book } from "../types/reading";
import { createEmptyTierBoard, type TierBoard, type TierKey } from "../types/tier";

type TierContainer = TierKey | "pool";
type SortableAttributes = ReturnType<typeof useSortable>["attributes"];
type SortableListeners = ReturnType<typeof useSortable>["listeners"];

const tierRows: Array<{ id: TierKey; color: string }> = [
  { id: "S", color: "#F08A82" },
  { id: "A", color: "#F4B86E" },
  { id: "B", color: "#F2D86B" },
  { id: "C", color: "#A8D982" },
  { id: "D", color: "#8FC7F2" },
];

type TierMakerScreenProps = {
  books: Book[];
  board: TierBoard;
  onChangeBoard: Dispatch<SetStateAction<TierBoard>>;
};

type TierBookTileProps = {
  book: Book;
  isSelected: boolean;
  size?: "board" | "pool";
  onSelect: () => void;
};

type TierBookTileRenderProps = TierBookTileProps & {
  attributes?: SortableAttributes;
  listeners?: SortableListeners;
  setNodeRef?: (element: HTMLButtonElement | null) => void;
  style?: CSSProperties;
};

export const TierMakerScreen = ({
  books,
  board,
  onChangeBoard,
}: TierMakerScreenProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
  );
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const bookMap = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );
  const completedBookIds = useMemo(() => books.map((book) => book.id), [books]);
  const tierBookIds = (tier: TierKey, sourceBoard = board) =>
    sourceBoard[tier].filter((bookId) => bookMap.has(bookId));
  const rankedBookIds = new Set(
    tierRows.flatMap((tier) => tierBookIds(tier.id)),
  );
  const unrankedBooks = books.filter((book) => !rankedBookIds.has(book.id));
  const unrankedBookIds = unrankedBooks.map((book) => book.id);
  const activeBook = activeBookId ? bookMap.get(activeBookId) : null;

  const findContainer = (
    itemId: string,
    sourceBoard = board,
  ): TierContainer | null => {
    if (itemId === "pool") return "pool";
    if (tierRows.some((tier) => tier.id === itemId)) return itemId as TierKey;
    if (completedBookIds.includes(itemId) && !rankedBookIds.has(itemId)) {
      return "pool";
    }

    return (
      tierRows.find((tier) => sourceBoard[tier.id].includes(itemId))?.id ?? null
    );
  };

  const removeFromBoard = (sourceBoard: TierBoard, bookId: string) => {
    const next = createEmptyTierBoard();

    tierRows.forEach((tier) => {
      next[tier.id] = sourceBoard[tier.id].filter((id) => id !== bookId);
    });

    return next;
  };

  const moveBookToTier = (bookId: string, tier: TierKey) => {
    onChangeBoard((current) => {
      const next = removeFromBoard(current, bookId);

      next[tier] = [...next[tier], bookId];

      return next;
    });
    setSelectedBookId(null);
  };

  const moveBookToPool = (bookId: string) => {
    onChangeBoard((current) => removeFromBoard(current, bookId));
    setSelectedBookId(null);
  };

  const swapBooks = (firstBookId: string, secondBookId: string) => {
    if (firstBookId === secondBookId) {
      setSelectedBookId(null);
      return;
    }

    onChangeBoard((current) => {
      const firstTier = findContainer(firstBookId, current);
      const secondTier = findContainer(secondBookId, current);

      if (
        !firstTier ||
        !secondTier ||
        firstTier === "pool" ||
        secondTier === "pool"
      ) {
        return current;
      }

      const next = createEmptyTierBoard();

      tierRows.forEach((tier) => {
        next[tier.id] = [...current[tier.id]];
      });

      const firstIndex = next[firstTier].indexOf(firstBookId);
      const secondIndex = next[secondTier].indexOf(secondBookId);

      if (firstIndex < 0 || secondIndex < 0) return current;

      next[firstTier][firstIndex] = secondBookId;
      next[secondTier][secondIndex] = firstBookId;

      return next;
    });
    setSelectedBookId(null);
  };

  const handleBookTap = (bookId: string) => {
    if (!selectedBookId) {
      setSelectedBookId(bookId);
      return;
    }

    if (selectedBookId === bookId) {
      setSelectedBookId(null);
      return;
    }

    if (
      findContainer(selectedBookId) !== "pool" &&
      findContainer(bookId) !== "pool"
    ) {
      swapBooks(selectedBookId, bookId);
      return;
    }

    setSelectedBookId(bookId);
  };

  const handleTierClick = (tier: TierKey) => {
    if (selectedBookId) {
      moveBookToTier(selectedBookId, tier);
    }
  };

  const handlePoolClick = () => {
    if (selectedBookId && findContainer(selectedBookId) !== "pool") {
      moveBookToPool(selectedBookId);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveBookId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    setActiveBookId(null);

    if (!overId) return;

    onChangeBoard((current) => {
      const activeContainer = findContainer(activeId, current);
      const overContainer = findContainer(overId, current);

      if (!activeContainer || !overContainer) return current;

      const next = createEmptyTierBoard();

      tierRows.forEach((tier) => {
        next[tier.id] = current[tier.id].filter((bookId) =>
          bookMap.has(bookId),
        );
      });

      if (activeContainer === overContainer) {
        if (activeContainer === "pool") return current;

        const activeIndex = next[activeContainer].indexOf(activeId);
        const overIndex = next[activeContainer].indexOf(overId);

        if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
          return current;
        }

        next[activeContainer] = arrayMove(
          next[activeContainer],
          activeIndex,
          overIndex,
        );

        return next;
      }

      tierRows.forEach((tier) => {
        next[tier.id] = next[tier.id].filter((bookId) => bookId !== activeId);
      });

      if (overContainer === "pool") {
        return next;
      }

      const overIndex = next[overContainer].indexOf(overId);
      const insertIndex =
        overIndex >= 0 ? overIndex : next[overContainer].length;

      next[overContainer].splice(insertIndex, 0, activeId);

      return next;
    });
    setSelectedBookId(null);
  };

  if (books.length === 0) {
    return (
      <PixelCard className="bg-[#F3E8D0] text-center">
        <p className="text-sm font-black text-stone-700">
          완독한 책이 생기면 티어메이커를 만들 수 있습니다.
        </p>
      </PixelCard>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveBookId(null)}
    >
      <div className="space-y-3">
        <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 shadow-pixel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">완독 책 순위 보드</p>
              <p className="mt-1 text-[11px] font-black leading-relaxed text-stone-500">
                표지를 길게 눌러 끌어 놓거나, 책을 선택한 뒤 티어를 눌러
                배치합니다.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button px-2 py-1 text-[11px]"
              onClick={() => {
                onChangeBoard(createEmptyTierBoard());
                setSelectedBookId(null);
              }}
            >
              초기화
            </button>
          </div>
        </div>

        <div className="overflow-hidden border-3 border-[#2F2A26] bg-[#151A16] shadow-pixel">
          {tierRows.map((tier) => {
            const ids = tierBookIds(tier.id);
            const tierBooks = ids
              .map((bookId) => bookMap.get(bookId))
              .filter((book): book is Book => Boolean(book));

            return (
              <DroppableTierRow
                key={tier.id}
                tier={tier}
                bookIds={ids}
                bookCount={tierBooks.length}
                onClick={() => handleTierClick(tier.id)}
              >
                {tierBooks.map((book) => (
                  <SortableTierBookTile
                    key={book.id}
                    book={book}
                    isSelected={selectedBookId === book.id}
                    size="board"
                    onSelect={() => handleBookTap(book.id)}
                  />
                ))}
              </DroppableTierRow>
            );
          })}
        </div>

        <DroppablePool
          bookIds={unrankedBookIds}
          bookCount={unrankedBooks.length}
          onClick={handlePoolClick}
        >
          {unrankedBooks.map((book) => (
            <SortableTierBookTile
              key={book.id}
              book={book}
              isSelected={selectedBookId === book.id}
              size="pool"
              onSelect={() => handleBookTap(book.id)}
            />
          ))}
        </DroppablePool>
      </div>
      <DragOverlay>
        {activeBook ? (
          <TierBookTile
            book={activeBook}
            isSelected={false}
            size={findContainer(activeBook.id) === "pool" ? "pool" : "board"}
            onSelect={() => undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

type DroppableTierRowProps = {
  tier: { id: TierKey; color: string };
  bookIds: string[];
  bookCount: number;
  children: ReactNode;
  onClick: () => void;
};

const DroppableTierRow = ({
  tier,
  bookIds,
  bookCount,
  children,
  onClick,
}: DroppableTierRowProps) => {
  const { isOver, setNodeRef } = useDroppable({ id: tier.id });

  return (
    <section
      ref={setNodeRef}
      className={`border-b-2 border-[#2F2A26] last:border-b-0 ${
        isOver ? "bg-[#2A332B]" : "bg-[#151A16]"
      }`}
      onClick={onClick}
    >
      <div
        className="flex h-8 items-center justify-between border-b-2 border-[#2F2A26] px-3 text-sm font-black text-[#2F2A26]"
        style={{ backgroundColor: tier.color }}
      >
        <span>{tier.id} TIER</span>
        <span>{bookCount}권</span>
      </div>
      <SortableContext items={bookIds} strategy={horizontalListSortingStrategy}>
        <div className="flex min-h-[112px] min-w-0 items-start gap-0 overflow-x-auto p-0">
          {children}
        </div>
      </SortableContext>
    </section>
  );
};

type DroppablePoolProps = {
  bookIds: string[];
  bookCount: number;
  children: ReactNode;
  onClick: () => void;
};

const DroppablePool = ({
  bookIds,
  bookCount,
  children,
  onClick,
}: DroppablePoolProps) => {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });

  return (
    <section
      ref={setNodeRef}
      className={`space-y-2 border-2 border-[#2F2A26] bg-[#F3E8D0] p-2 shadow-pixel ${
        isOver ? "outline-3 outline-offset-2 outline-[#87937A]" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-stone-700">아직 배치 안 한 책</p>
        <span className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-1 text-[11px] font-black">
          {bookCount}권
        </span>
      </div>
      {bookCount === 0 ? (
        <div className="border-2 border-dashed border-stone-500 bg-[#FCFBF7] p-3 text-center text-xs font-black text-stone-500">
          모든 완독 책을 티어에 배치했습니다.
        </div>
      ) : (
        <SortableContext items={bookIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2">{children}</div>
        </SortableContext>
      )}
    </section>
  );
};

const SortableTierBookTile = ({
  book,
  isSelected,
  size = "pool",
  onSelect,
}: TierBookTileProps) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: book.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <TierBookTile
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
      style={style}
      book={book}
      isSelected={isSelected}
      size={size}
      onSelect={onSelect}
    />
  );
};

const TierBookTile = ({
  book,
  isSelected,
  size = "pool",
  onSelect,
  attributes,
  listeners,
  setNodeRef,
  style,
}: TierBookTileRenderProps) => {
  const tileSizeClass =
    size === "board" ? "w-[76px] shrink-0 sm:w-[82px]" : "w-full";

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`relative overflow-hidden border-2 bg-[#FFFDF8] text-left ${tileSizeClass} ${
        isSelected
          ? "border-[#F2C94C] shadow-[0_0_0_2px_#F2C94C]"
          : "border-[#2F2A26]"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      {...attributes}
      {...listeners}
    >
      <div className="aspect-[3/4] w-full bg-[#E8DFC2]">
        {book.thumbnail ? (
          <img
            className="h-full w-full object-cover"
            src={book.thumbnail}
            alt=""
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center px-1 text-center text-[8px] font-black leading-tight text-[#FFFDF8]"
            style={{ backgroundColor: book.accentColor }}
          >
            {book.title}
          </div>
        )}
      </div>
    </button>
  );
};
