import type { PropsWithChildren } from 'react'

type PixelCardProps = PropsWithChildren<{
  className?: string
}>

export const PixelCard = ({ children, className = '' }: PixelCardProps) => (
  <section className={`pixel-card ${className}`}>{children}</section>
)
