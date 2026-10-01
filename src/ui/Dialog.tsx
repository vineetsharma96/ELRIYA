import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'

export default function Dialog({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('button')?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href], [tabindex="0"]')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', trap); previous?.focus() }
  }, [])
  return <div className="dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={panel} className={`dialog-panel ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <button className="icon-button dialog-close" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
      <div className="eyebrow">{eyebrow}</div>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </div>
  </div>
}
