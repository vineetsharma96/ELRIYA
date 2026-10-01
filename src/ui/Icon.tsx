import type { ReactNode } from 'react'

export type IconName = 'sun' | 'moon' | 'sound' | 'muted' | 'menu' | 'close' | 'map' | 'camera' | 'arrow' | 'leaf' | 'pause' | 'compass'

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></>,
    moon: <path d="M20.2 15.1A8.6 8.6 0 0 1 8.9 3.8 8.6 8.6 0 1 0 20.2 15.1Z" />,
    sound: <><path d="m10 5-5 4H2v6h3l5 4V5Z" /><path d="M14 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    muted: <><path d="m10 5-5 4H2v6h3l5 4V5Z" /><path d="m16 9 5 6m0-6-5 6" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" /><path d="M9 3v16M15 5v16" /></>,
    camera: <><path d="M4 6h4l2-3h4l2 3h4v14H4V6Z" /><circle cx="12" cy="12" r="4" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    leaf: <><path d="M20 3C9 1 2 7 4 15s17 9 16-12Z" /><path d="M3 21 15 9m-6 6h6m-6 0V9" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.7 5.3L8 16l2.7-5.3L16 8Z" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function Blossom({ size = 32 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor">{[0, 72, 144, 216, 288].map(angle => <ellipse key={angle} cx="20" cy="11.2" rx="5.8" ry="9" transform={`rotate(${angle} 20 20)`} />)}</g><circle cx="20" cy="20" r="3.3" fill="#fff9ea" /></svg>
}
