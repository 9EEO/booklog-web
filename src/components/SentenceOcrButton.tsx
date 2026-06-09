import { useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { BottomSheetModal } from "./BottomSheetModal";
import { Icon } from "./Icon";
import { recognizeSentenceImage } from "../services/sentenceOcr";

type SentenceOcrButtonProps = {
  onRecognized: (text: string) => void;
  disabled?: boolean;
};

export const SentenceOcrButton = ({
  onRecognized,
  disabled = false,
}: SentenceOcrButtonProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState("");
  const [recognizedLines, setRecognizedLines] = useState<string[]>([]);
  const [selectedLineIndexes, setSelectedLineIndexes] = useState<Set<number>>(
    new Set(),
  );
  const [selectedText, setSelectedText] = useState("");

  const closeSelector = () => {
    setRecognizedLines([]);
    setSelectedLineIndexes(new Set());
    setSelectedText("");
  };

  const updateSelection = (nextIndexes: Set<number>) => {
    setSelectedLineIndexes(nextIndexes);
    setSelectedText(
      recognizedLines
        .filter((_, index) => nextIndexes.has(index))
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
      const text = await recognizeSentenceImage(file);
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      setRecognizedLines(lines);
      setSelectedLineIndexes(new Set());
      setSelectedText("");
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
                <p>담고 싶은 문장을 눌러 선택해 주세요.</p>
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
                {selectedLineIndexes.size}/{recognizedLines.length}개 선택
              </span>
              <button type="button" onClick={toggleAllLines}>
                {selectedLineIndexes.size === recognizedLines.length
                  ? "전체 해제"
                  : "전체 선택"}
              </button>
            </div>

            <div className="sentence-ocr-line-list">
              {recognizedLines.map((line, index) => {
                const isSelected = selectedLineIndexes.has(index);

                return (
                  <button
                    key={`${index}-${line}`}
                    type="button"
                    className={`sentence-ocr-line ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleLine(index)}
                    aria-pressed={isSelected}
                  >
                    <span className="sentence-ocr-line-check">
                      {isSelected && <Icon name="check" className="h-4 w-4" />}
                    </span>
                    <span>{line}</span>
                  </button>
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
