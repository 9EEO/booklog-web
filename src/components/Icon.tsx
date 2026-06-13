import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "home"
  | "timer"
  | "records"
  | "library"
  | "profile"
  | "play"
  | "pause"
  | "stop"
  | "swap"
  | "close"
  | "save"
  | "clock"
  | "leaf"
  | "quote"
  | "check"
  | "book"
  | "calendar"
  | "chevronLeft"
  | "chevronRight"
  | "edit"
  | "trash"
  | "plus"
  | "minus"
  | "copy"
  | "share"
  | "camera"
  | "tier";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  variant?: "default" | "bulk";
};

const softCircle = <circle className="icon-bulk-soft" cx="12" cy="12" r="9" />;

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path className="icon-bulk-soft" d="M4 10.8 12 4l8 6.8V20H4v-9.2Z" />
      <path d="m3 10.4 8-6.8a1.55 1.55 0 0 1 2 0l8 6.8a1 1 0 0 1-1.3 1.52L12 5.38l-7.7 6.54A1 1 0 1 1 3 10.4ZM9 13.5A1.5 1.5 0 0 1 10.5 12h3a1.5 1.5 0 0 1 1.5 1.5V20H9v-6.5Z" />
    </>
  ),
  timer: (
    <>
      <circle className="icon-bulk-soft" cx="12" cy="13" r="8.5" />
      <path d="M9.5 2.5a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-.5v1.05a8.8 8.8 0 1 1-2 0V3.5h-.5a1 1 0 0 1-1-1ZM12 6.25A6.75 6.75 0 1 0 18.75 13 6.76 6.76 0 0 0 12 6.25Zm1 2.5v3.72l2.45 1.42a1 1 0 1 1-1 1.72l-2.95-1.7A1 1 0 0 1 11 13V8.75a1 1 0 1 1 2 0Z" />
    </>
  ),
  records: (
    <>
      <rect
        className="icon-bulk-soft"
        x="4"
        y="3"
        width="16"
        height="18"
        rx="3"
      />
      <path d="M8 2h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm1 6a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Zm0 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Zm0 4a1 1 0 1 0 0 2h3.5a1 1 0 1 0 0-2H9Z" />
    </>
  ),
  library: (
    <>
      <path
        className="icon-bulk-soft"
        d="M3 5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15H5a2 2 0 0 1-2-2V5Zm10 1a3 3 0 0 1 3-3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6V6Z"
      />
      <path d="M4 3h5a4 4 0 0 1 4 4v12.35A4.97 4.97 0 0 1 16 18h4V5h-4a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-5a3 3 0 0 0-3 3h-2a3 3 0 0 0-3-3H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1Zm0 2v13h4a4.97 4.97 0 0 1 3 1.35V7a2 2 0 0 0-2-2H4Z" />
    </>
  ),
  profile: (
    <>
      <circle className="icon-bulk-soft" cx="12" cy="8" r="5" />
      <path className="icon-bulk-soft" d="M3.5 21a8.5 8.5 0 0 1 17 0h-17Z" />
      <path d="M12 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 10.5c5.08 0 8.5 2.7 8.5 6a1 1 0 1 1-2 0c0-1.88-2.38-4-6.5-4s-6.5 2.12-6.5 4a1 1 0 1 1-2 0c0-3.3 3.42-6 8.5-6Z" />
    </>
  ),
  play: (
    <>
      {softCircle}
      <path d="M9 7.2a1.4 1.4 0 0 1 2.13-1.2l8.15 4.8a1.4 1.4 0 0 1 0 2.4L11.13 18A1.4 1.4 0 0 1 9 16.8V7.2Z" />
    </>
  ),
  pause: (
    <>
      {softCircle}
      <path d="M8.5 7A1.5 1.5 0 0 1 10 5.5h.5A1.5 1.5 0 0 1 12 7v10a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 17V7Zm5 0A1.5 1.5 0 0 1 15 5.5h.5A1.5 1.5 0 0 1 17 7v10a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5V7Z" />
    </>
  ),
  stop: (
    <>
      {softCircle}
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </>
  ),
  swap: (
    <>
      <path
        className="icon-bulk-soft"
        d="M4 5h14a3 3 0 0 1 3 3v1H7a3 3 0 0 1-3-3V5Zm16 14H6a3 3 0 0 1-3-3v-1h14a3 3 0 0 1 3 3v1Z"
      />
      <path d="M16.3 3.3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 1 1-1.4-1.4L17.58 8H5a1 1 0 0 1 0-2h12.58L16.3 4.7a1 1 0 0 1 0-1.4Zm-8.6 10a1 1 0 0 1 0 1.4L6.42 16H19a1 1 0 1 1 0 2H6.42l1.28 1.3a1 1 0 0 1-1.4 1.4l-3-3a1 1 0 0 1 0-1.4l3-3a1 1 0 0 1 1.4 0Z" />
    </>
  ),
  close: (
    <>
      {softCircle}
      <path d="M8.05 6.64 12 10.59l3.95-3.95a1 1 0 1 1 1.41 1.41L13.41 12l3.95 3.95a1 1 0 0 1-1.41 1.41L12 13.41l-3.95 3.95a1 1 0 0 1-1.41-1.41L10.59 12 6.64 8.05a1 1 0 1 1 1.41-1.41Z" />
    </>
  ),
  save: (
    <>
      <path className="icon-bulk-soft" d="M4 3h13l3 3v15H4V3Z" />
      <path d="M5 2h12.41L21 5.59V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1Zm2 2v5h8V4H7Zm-2 0v16h14V6.41L16.59 4H17v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4Zm4 11h6a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2Z" />
    </>
  ),
  clock: (
    <>
      {softCircle}
      <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.45l3.35 1.93a1 1 0 1 1-1 1.74l-3.85-2.23A1 1 0 0 1 11 12V7a1 1 0 1 1 2 0Z" />
    </>
  ),
  leaf: (
    <>
      <path
        className="icon-bulk-soft"
        d="M20.8 3.2C11.2 3 4.2 6.8 4 13.3c-.13 4.44 4.2 7.35 8.12 5.26C17 15.96 19.8 10.9 20.8 3.2Z"
      />
      <path d="M21.45 2.55a1 1 0 0 1 .28.88c-.9 8.5-4.06 13.98-9.14 16.68-3.68 1.96-7.72.56-9.07-2.55-1.66-3.83.96-8.3 5.02-10.68 3.1-1.81 7.2-3.26 12-4.6a1 1 0 0 1 .91.27ZM6 19.5c2.25-4.35 5.62-7.87 10.82-11.18a1 1 0 0 1 1.08 1.69C13 13.12 9.91 16.35 7.78 20.42A1 1 0 1 1 6 19.5Z" />
    </>
  ),
  quote: (
    <>
      <path
        className="icon-bulk-soft"
        d="M3 5h8v8H7v6H3V5Zm10 0h8v8h-4v6h-4V5Z"
      />
      <path d="M4 4h7a1 1 0 0 1 1 1v7c0 4.3-2.45 7.5-6 8.8a1 1 0 0 1-.7-1.88A7.05 7.05 0 0 0 9.85 14H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 0h7a1 1 0 0 1 1 1v7c0 4.3-2.45 7.5-6 8.8a1 1 0 0 1-.7-1.88A7.05 7.05 0 0 0 19.85 14H14a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    </>
  ),
  check: (
    <>
      {softCircle}
      <path d="M18.7 7.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4l2.8 2.79 6.8-6.8a1 1 0 0 1 1.4.01Z" />
    </>
  ),
  book: (
    <>
      <path
        className="icon-bulk-soft"
        d="M3 4h8a3 3 0 0 1 3 3v14H6a3 3 0 0 1-3-3V4Zm11 3a3 3 0 0 1 3-3h4v14a3 3 0 0 1-3 3h-4V7Z"
      />
      <path d="M4 3h6a5 5 0 0 1 3 1 5 5 0 0 1 3-1h4a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-4a3 3 0 0 0-3 3h-2a3 3 0 0 0-3-3H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm1 2v13h3a5 5 0 0 1 3 1V8a3 3 0 0 0-3-3H5Zm11 0a3 3 0 0 0-3 3v11a5 5 0 0 1 3-1h3V5h-3Z" />
    </>
  ),
  calendar: (
    <>
      <rect
        className="icon-bulk-soft"
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
      />
      <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1ZM4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9H4Zm3 3a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 7 13Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
    </>
  ),
  chevronLeft: (
    <>
      {softCircle}
      <path d="M14.7 6.3a1 1 0 0 1 0 1.4L10.4 12l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
    </>
  ),
  chevronRight: (
    <>
      {softCircle}
      <path d="M9.3 6.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 1 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
    </>
  ),
  edit: (
    <>
      <path
        className="icon-bulk-soft"
        d="M4 14.5V20h5.5L20 9.5 14.5 4 4 14.5Z"
      />
      <path d="m14.3 3.3 6.4 6.4L10.4 20H4a1 1 0 0 1-1-1v-5.4L13.3 3.3a1 1 0 0 1 1 0Zm0 2.12L5 14.72V18h3.28l9.3-9.3-3.28-3.28ZM18 2a1 1 0 0 1 .7.3l3 3a1 1 0 0 1 0 1.4l-1.3 1.3L16 3.6l1.3-1.3A1 1 0 0 1 18 2Z" />
    </>
  ),
  trash: (
    <>
      <path className="icon-bulk-soft" d="M6 7h12l-1 14H7L6 7Z" />
      <path d="M9 2h6a1 1 0 0 1 .9.55L16.62 4H20a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2h3.38l.72-1.45A1 1 0 0 1 9 2Zm-3 6h12l-.88 12.15A2 2 0 0 1 15.12 22H8.88a2 2 0 0 1-2-1.85L6 8Zm4 3a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Z" />
    </>
  ),
  plus: (
    <>
      {softCircle}
      <path d="M12 6a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H7a1 1 0 1 1 0-2h4V7a1 1 0 0 1 1-1Z" />
    </>
  ),
  minus: (
    <>
      {softCircle}
      <path d="M7 11h10a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2Z" />
    </>
  ),
  copy: (
    <>
      <rect
        className="icon-bulk-soft"
        x="7"
        y="3"
        width="14"
        height="14"
        rx="3"
      />
      <path d="M10 2h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-1v1a3 3 0 0 1-3 3H6a4 4 0 0 1-4-4v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4Zm-4 7H5a1 1 0 0 0-1 1v8a2 2 0 0 0 2 2h8a1 1 0 0 0 1-1v-1h-5a4 4 0 0 1-4-4V9Zm4-5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-8Z" />
    </>
  ),
  share: (
    <>
      <circle className="icon-bulk-soft" cx="18" cy="5" r="4" />
      <circle className="icon-bulk-soft" cx="6" cy="12" r="4" />
      <circle className="icon-bulk-soft" cx="18" cy="19" r="4" />
      <path d="M18 1a4 4 0 1 1-3.65 5.63L9.8 9.28a4 4 0 0 1 0 5.44l4.55 2.65A4 4 0 1 1 13.6 20a3.97 3.97 0 0 1 .1-.87L8.78 16.3A4 4 0 1 1 8.78 7.7l4.92-2.83A4 4 0 0 1 18 1Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </>
  ),
  camera: (
    <>
      <rect
        className="icon-bulk-soft"
        x="2"
        y="5"
        width="20"
        height="16"
        rx="4"
      />
      <circle className="icon-bulk-soft" cx="12" cy="13" r="5" />
      <path d="M9.4 3h5.2a1 1 0 0 1 .8.4L16.6 5H19a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h2.4l1.2-1.6a1 1 0 0 1 .8-.4ZM5 7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.4l-1.5-2h-4.2L8.4 7H5Zm7 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </>
  ),
  tier: (
    <>
      <rect
        className="icon-bulk-soft"
        x="3"
        y="3"
        width="18"
        height="5"
        rx="2"
      />
      <rect
        className="icon-bulk-soft"
        x="3"
        y="10"
        width="14"
        height="5"
        rx="2"
      />
      <rect
        className="icon-bulk-soft"
        x="3"
        y="17"
        width="10"
        height="5"
        rx="2"
      />
      <path d="M4 2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v3h16V4H4Zm0 6h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm0 2v3h12v-3H4Zm0 6h8a2 2 0 0 1 2 2v2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2Z" />
    </>
  ),
};

export const Icon = ({
  name,
  variant = "default",
  className = "h-5 w-5",
  ...props
}: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`bulk-icon ${variant === "bulk" ? "bulk-icon-soft" : ""} ${className}`}
    fill="currentColor"
    {...props}
  >
    {paths[name]}
  </svg>
);
