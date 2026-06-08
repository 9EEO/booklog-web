import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'timer'
  | 'records'
  | 'library'
  | 'profile'
  | 'play'
  | 'pause'
  | 'stop'
  | 'swap'
  | 'close'
  | 'save'
  | 'clock'
  | 'leaf'
  | 'quote'
  | 'check'
  | 'book'
  | 'calendar'
  | 'chevronLeft'
  | 'chevronRight'
  | 'edit'
  | 'trash'
  | 'plus'
  | 'minus'
  | 'copy'
  | 'share'
  | 'tier'

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
}

const paths: Record<IconName, ReactNode> = {
  home: <path d="M3 11h2v8h5v-5h4v5h5v-8h2L12 3 3 11Zm4 6v-7.1l5-4.5 5 4.5V17h-1v-5H8v5H7Z" />,
  timer: <path d="M10 2h4v2h-4V2Zm1 10V6h2v7h5v2h-7v-3Zm1 10a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />,
  records: <path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 3h6v2H9V8Zm0 4h6v2H9v-2Zm0 4h4v2H9v-2Z" />,
  library: <path d="M4 4h5v16H4V4Zm2 2v12h1V6H6Zm5-2h5v16h-5V4Zm2 2v12h1V6h-1Zm5 1 3-.8 3.8 14.6-3 .8L18 7Zm2.2 1.3 2.8 10.8.9-.2-2.8-10.8-.9.2Z" />,
  profile: <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-7 9c.8-3.5 3.3-5 7-5s6.2 1.5 7 5v1H5v-1Zm2.4-1h9.2c-.8-1.4-2.2-2-4.6-2s-3.8.6-4.6 2Z" />,
  play: <path d="M7 4v16l13-8L7 4Zm2 3.6 7.2 4.4L9 16.4V7.6Z" />,
  pause: <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />,
  stop: <path d="M6 6h12v12H6V6Z" />,
  swap: <path d="M7 7h10l-3-3 1.4-1.4L20.8 8l-5.4 5.4L14 12l3-3H7V7Zm10 10H7l3 3-1.4 1.4L3.2 16l5.4-5.4L10 12l-3 3h10v2Z" />,
  close: <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />,
  save: <path d="M5 3h12l2 2v16H5V3Zm2 2v14h10V6.2L15.8 5H15v5H8V5H7Zm3 0v3h3V5h-3Zm-1 9h6v2H9v-2Z" />,
  clock: <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-13h2v5.2l3.4 2-1 1.8-4.4-2.6V7Z" />,
  leaf: <path d="M20 4c-8.2-.4-13.7 2.8-15.4 8.3-1 3.1.1 5.7 2.3 7.2 2.4 1.6 5.8 1.5 8.4-.9 2.8-2.7 4.4-7.1 4.7-14.6Zm-2.2 2.2c-.5 5.3-1.8 8.8-3.9 10.9-1.9 1.8-4.1 1.8-5.8.7-1.4-1-2.3-2.7-1.6-4.9 1.2-3.7 4.8-6.3 11.3-6.7ZM6 19c2.9-4.4 5.5-7 9.8-9.4l.9 1.8c-4 2.2-6.3 4.4-9 8.7L6 19Z" />,
  quote: <path d="M7 6h6v6H9v6H5v-8c0-2.2.8-3.5 2-4Zm9 0h6v6h-4v6h-4v-8c0-2.2.8-3.5 2-4Z" />,
  check: <path d="m9.5 16.2-4.2-4.1L4 13.5 9.5 19 20.4 8.1 19 6.7 9.5 16.2Z" />,
  book: <path d="M5 4h9a4 4 0 0 1 4 4v12h-9a4 4 0 0 0-4-4V4Zm2 2v9.1c.6-.5 1.3-.8 2-.9V6H7Zm4 0v12h5V8a2 2 0 0 0-2-2h-3Z" />,
  calendar: <path d="M7 2h2v3h6V2h2v3h3v17H4V5h3V2Zm11 8H6v10h12V10ZM6 8h12V7h-1v1h-2V7H9v1H7V7H6v1Zm2 4h2v2H8v-2Zm4 0h2v2h-2v-2Zm4 0h1v2h-1v-2Zm-8 4h2v2H8v-2Zm4 0h2v2h-2v-2Z" />,
  chevronLeft: <path d="m14.6 5 1.4 1.4L10.4 12l5.6 5.6-1.4 1.4-7-7 7-7Z" />,
  chevronRight: <path d="M9.4 19 8 17.6l5.6-5.6L8 6.4 9.4 5l7 7-7 7Z" />,
  edit: <path d="M5 17.2V20h2.8L18.5 9.3l-2.8-2.8L5 17.2Zm2 0 8.7-8.7.8.8L7.8 18H7v-.8ZM17.1 5.1l1.4-1.4c.4-.4 1-.4 1.4 0l.4.4c.4.4.4 1 0 1.4l-1.4 1.4-1.8-1.8ZM4 4h9v2H6v12h12v-7h2v9H4V4Z" />,
  trash: <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm2.1 2 .5 8h4.8l.5-8H9.1Zm1.4 1h2v6h-2v-6Z" />,
  plus: <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />,
  minus: <path d="M5 11h14v2H5v-2Z" />,
  copy: <path d="M8 3h11v13h-3v5H5V8h3V3Zm2 5h6v6h1V5h-7v3Zm4 2H7v9h7v-9Z" />,
  share: <path d="M18 3a3 3 0 1 1-2.8 4L9.8 10.7a3 3 0 0 1 0 2.6l5.4 3.7a3 3 0 1 1-1.1 1.7L8.7 15a3 3 0 1 1 0-6l5.4-3.7A3 3 0 0 1 18 3Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM7 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm11 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  tier: <path d="M4 5h16v4H4V5Zm2 2h12V7H6Zm-2 4h13v4H4v-4Zm2 2h9v-.1H6v.1Zm-2 4h10v4H4v-4Zm2 2h6v-.1H6v.1Z" />,
}

export const Icon = ({ name, className = 'h-5 w-5', ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor" {...props}>
    {paths[name]}
  </svg>
)
