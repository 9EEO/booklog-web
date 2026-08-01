import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { BottomSheetModal } from "./BottomSheetModal";
import { Icon } from "./Icon";
import {
  recognizeSentenceImage,
  type OcrLineBoundingBox,
} from "../services/sentenceOcr";

type SentenceOcrButtonProps = {
  onRecognized: (text: string) => void;
  disabled?: boolean;
};

type RecognizedLine = {
  text: string;
  pageNumber: number;
  boundingBox?: OcrLineBoundingBox;
};

type RecognizedPage = {
  pageNumber: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  lineIndexes: number[];
};

export const SentenceOcrButton = ({
  onRecognized,
  disabled = false,
}: SentenceOcrButtonProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognizedPagesRef = useRef<RecognizedPage[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState("");
  const [recognizedLines, setRecognizedLines] = useState<RecognizedLine[]>([]);
  const [recognizedPages, setRecognizedPages] = useState<RecognizedPage[]>([]);
  const [selectedLineIndexes, setSelectedLineIndexes] = useState<Set<number>>(
    new Set(),
  );
  const [selectedText, setSelectedText] = useState("");
  const [recognizedPageCount, setRecognizedPageCount] = useState(0);

  const revokeRecognizedPageImages = (pages: RecognizedPage[]) => {
    pages.forEach((page) => URL.revokeObjectURL(page.imageUrl));
  };

  const closeSelector = () => {
    revokeRecognizedPageImages(recognizedPagesRef.current);
    recognizedPagesRef.current = [];
    setRecognizedLines([]);
    setRecognizedPages([]);
    setSelectedLineIndexes(new Set());
    setSelectedText("");
    setRecognizedPageCount(0);
    setError("");
  };

  useEffect(() => {
    recognizedPagesRef.current = recognizedPages;
  }, [recognizedPages]);

  useEffect(
    () => () => {
      revokeRecognizedPageImages(recognizedPagesRef.current);
    },
    [],
  );

  const updateSelection = (nextIndexes: Set<number>) => {
    setSelectedLineIndexes(nextIndexes);
    setSelectedText(
      recognizedLines
        .filter((_, index) => nextIndexes.has(index))
        .map((line) => line.text)
        .join("\n"),
    );
  };

  const toggleLine = (index: number) => {
    const nextIndexes = new Set(selectedLineIndexes);
    if (nextIndexes.has(index)) {
      nextIndexes.delete(index);
    } else {
      nextIndexes.add(index);
    }
    updateSelection(nextIndexes);
  };

  const toggleAllLines = () => {
    updateSelection(
      selectedLineIndexes.size === recognizedLines.length
        ? new Set()
        : new Set(recognizedLines.map((_, index) => index)),
    );
  };

  const confirmSelection = () => {
    const text = selectedText.trim();
    if (!text) return;

    onRecognized(text);
    closeSelector();
  };

  const recognizeImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isRecognizing) return;

    setIsRecognizing(true);
    setError("");

    try {
      const result = await recognizeSentenceImage(file);
      const nextPageNumber =
        (recognizedLines.at(-1)?.pageNumber ?? recognizedPageCount) + 1;
      const firstLineIndex = recognizedLines.length;
      const nextLines = result.lines.map((line) => ({
        text: line.text,
        boundingBox: line.boundingBox,
        pageNumber: nextPageNumber,
      }));
      const lineIndexes = nextLines.map((_, index) => firstLineIndex + index);

      setRecognizedLines((currentLines) => [...currentLines, ...nextLines]);
      setRecognizedPages((currentPages) => [
        ...currentPages,
        {
          pageNumber: nextPageNumber,
          imageUrl: result.imageUrl,
          imageWidth: result.imageWidth,
          imageHeight: result.imageHeight,
          lineIndexes,
        },
      ]);
      setRecognizedPageCount((currentCount) => currentCount + 1);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "사진 속 문장을 인식하지 못했습니다.",
      );
    } finally {
      setIsRecognizing(false);
    }
  };

  const getOverlayStyle = (
    boundingBox: OcrLineBoundingBox,
    page: RecognizedPage,
  ): CSSProperties => ({
    left: `${(boundingBox.x / page.imageWidth) * 100}%`,
    top: `${(boundingBox.y / page.imageHeight) * 100}%`,
    width: `${(boundingBox.width / page.imageWidth) * 100}%`,
    height: `${(boundingBox.height / page.imageHeight) * 100}%`,
  });

  return (
    <div className="sentence-ocr-control">
      <input
        ref={inputRef}
        className="sentence-ocr-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void recognizeImage(event)}
        disabled={disabled || isRecognizing}
      />
      <button
        type="button"
        className="sentence-ocr-button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isRecognizing}
      >
        <Icon name="camera" className="h-4 w-4" />
        {isRecognizing ? "문장 인식 중" : "사진으로 담기"}
      </button>
      {error && <p className="sentence-ocr-error">{error}</p>}
      {typeof document !== "undefined" &&
        createPortal(
          <BottomSheetModal
            isOpen={recognizedLines.length > 0}
            ariaLabel="사진에서 문장 고르기"
            backdropClassName="sentence-ocr-selector-backdrop"
            panelClassName="sentence-ocr-selector-sheet"
            onBackdropClick={closeSelector}
          >
            <div className="sentence-ocr-selector-header">
              <div>
                <h2>문장 고르기</h2>
                <p>페이지가 이어지면 다음 장도 촬영할 수 있어요.</p>
              </div>
              <button
                type="button"
                className="sentence-ocr-selector-close"
                onClick={closeSelector}
                aria-label="닫기"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="sentence-ocr-selector-toolbar">
              <span>
                사진 {recognizedPageCount}장 · {selectedLineIndexes.size}/
                {recognizedLines.length}개 선택
              </span>
              <button type="button" onClick={toggleAllLines}>
                {selectedLineIndexes.size === recognizedLines.length
                  ? "전체 해제"
                  : "전체 선택"}
              </button>
            </div>

            <button
              type="button"
              className="sentence-ocr-add-page"
              onClick={() => inputRef.current?.click()}
              disabled={isRecognizing}
            >
              <Icon name="camera" className="h-4 w-4" />
              {isRecognizing ? "다음 페이지 인식 중" : "다음 페이지 이어 담기"}
            </button>

            {error && <p className="sentence-ocr-selector-error">{error}</p>}

            {recognizedPages.length > 0 && (
              <div className="sentence-ocr-image-pages">
                {recognizedPages.map((page) => (
                  <figure
                    key={`${page.pageNumber}-${page.imageUrl}`}
                    className="sentence-ocr-image-page"
                  >
                    <figcaption>
                      {page.pageNumber === 1
                        ? "첫 페이지"
                        : `${page.pageNumber}번째 페이지`}
                    </figcaption>
                    <div className="sentence-ocr-image-frame">
                      <img src={page.imageUrl} alt="" />
                      {page.lineIndexes.map((lineIndex) => {
                        const line = recognizedLines[lineIndex];
                        if (!line?.boundingBox) return null;

                        const isSelected = selectedLineIndexes.has(lineIndex);

                        return (
                          <button
                            key={`${page.pageNumber}-${lineIndex}`}
                            type="button"
                            className={`sentence-ocr-image-line ${
                              isSelected ? "is-selected" : ""
                            }`}
                            style={getOverlayStyle(line.boundingBox, page)}
                            onClick={() => toggleLine(lineIndex)}
                            aria-label={line.text}
                            aria-pressed={isSelected}
                          >
                            <span>{line.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </figure>
                ))}
              </div>
            )}

            <div className="sentence-ocr-line-list">
              {recognizedLines.map((line, index) => {
                const isSelected = selectedLineIndexes.has(index);
                const startsPage =
                  index === 0 ||
                  recognizedLines[index - 1]?.pageNumber !== line.pageNumber;

                return (
                  <Fragment key={`${line.pageNumber}-${index}-${line.text}`}>
                    {startsPage && (
                      <div className="sentence-ocr-page-divider">
                        <span>
                          {line.pageNumber === 1
                            ? "첫 페이지"
                            : `${line.pageNumber}번째 페이지`}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      className={`sentence-ocr-line ${isSelected ? "is-selected" : ""}`}
                      onClick={() => toggleLine(index)}
                      aria-pressed={isSelected}
                    >
                      <span className="sentence-ocr-line-check">
                        {isSelected && (
                          <Icon name="check" className="h-4 w-4" />
                        )}
                      </span>
                      <span>{line.text}</span>
                    </button>
                  </Fragment>
                );
              })}
            </div>

            <label className="sentence-ocr-preview">
              선택한 문장
              <textarea
                value={selectedText}
                onChange={(event) => setSelectedText(event.target.value)}
                placeholder="위에서 문장을 선택하면 여기에 모여요."
              />
            </label>

            <div className="sentence-ocr-selector-actions">
              <button type="button" onClick={closeSelector}>
                취소
              </button>
              <button
                type="button"
                onClick={confirmSelection}
                disabled={!selectedText.trim()}
              >
                문장 담기
              </button>
            </div>
          </BottomSheetModal>,
          document.body,
        )}
    </div>
  );
};
