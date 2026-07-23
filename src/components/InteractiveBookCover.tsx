import { useState, type CSSProperties } from "react";
import { useBookCoverTilt } from "../hooks/useBookCoverTilt";

type InteractiveBookCoverProps = {
  coverImage?: string;
  title: string;
  author: string;
  coverColor: string;
  accentColor: string;
  viewTransitionName?: string;
  transitionKey?: string;
  isSettled?: boolean;
};

type InteractiveBookCoverStyle = CSSProperties & {
  "--cover-color": string;
  "--cover-accent-color": string;
  viewTransitionName?: string;
};

export function InteractiveBookCover({
  coverImage,
  title,
  author,
  coverColor,
  accentColor,
  viewTransitionName,
  transitionKey,
  isSettled = true,
}: InteractiveBookCoverProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const { tiltRef, tiltHandlers } = useBookCoverTilt({ enabled: isSettled });
  const hasCoverImage = Boolean(coverImage) && !hasImageError;
  const style: InteractiveBookCoverStyle = {
    "--cover-color": coverColor,
    "--cover-accent-color": accentColor,
    viewTransitionName,
  };

  return (
    <div
      className={`interactive-book-cover-float ${
        isSettled ? "interactive-book-cover-float-ready" : ""
      }`}
      style={style}
    >
      <div
        ref={tiltRef}
        className="interactive-book-cover"
        data-book-transition-key={transitionKey}
        {...tiltHandlers}
      >
        {hasCoverImage ? (
          <img
            src={coverImage}
            alt={`${title} 표지`}
            draggable={false}
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className="interactive-book-cover-fallback">
            <strong>{title}</strong>
            <span>{author}</span>
          </div>
        )}
        <span className="interactive-book-cover-glare" aria-hidden="true" />
      </div>
    </div>
  );
}
