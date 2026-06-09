import { useRef, useState, type ChangeEvent } from "react";
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

  const recognizeImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isRecognizing) return;

    setIsRecognizing(true);
    setError("");

    try {
      onRecognized(await recognizeSentenceImage(file));
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
    </div>
  );
};
