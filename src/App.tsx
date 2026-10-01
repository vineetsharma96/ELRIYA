import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import WorldCanvas from './scene/WorldCanvas'
import { INITIAL_SNAPSHOT, type CameraMode, type WorldApi, type WorldSnapshot } from './scene/types'
import type { QualityMode } from './core/quality'
import Icon, { Blossom } from './ui/Icon'
import Dialog from './ui/Dialog'
import TouchControls from './ui/TouchControls'
import WorldMap from './ui/WorldMap'

class SceneBoundary extends Component<{ children: ReactNode; onFailure(message: string): void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { this.props.onFailure(error.message) }
  render() {
    if (this.state.failed) return <div className="scene-error" role="alert"><Blossom size={42} /><h1>A little pause in our world.</h1><p>The plaza could not load. Reload to retry, and check that the local server is running.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again <Icon name="arrow" /></button></div>
    return this.props.children
  }
}

function formatTime(hours: number) {
  const minutes = Math.floor(((hours % 24 + 24) % 24) * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

const QUALITY_MODES: QualityMode[] = ['AUTO', 'ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'LITE']

export default function App() {
  const apiRef = useRef<WorldApi | null>(null)
  const [snapshot, setSnapshot] = useState<WorldSnapshot>(INITIAL_SNAPSHOT)
  const [modal, setModal] = useState<'menu' | 'map' | null>(null)
  const [debug, setDebug] = useState(false)
  const [quality, setQuality] = useState<QualityMode>(() => {
    const requested = new URLSearchParams(window.location.search).get('quality')?.toUpperCase() as QualityMode
    return QUALITY_MODES.includes(requested) ? requested : 'AUTO'
  })
  const [camera, setCamera] = useState<CameraMode>('follow')
  const [audio, setAudio] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sceneError, setSceneError] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSnapshot = useCallback((next: WorldSnapshot) => setSnapshot(next), [])
  const toggleCamera = useCallback(() => setCamera(current => current === 'follow' ? 'vista' : 'follow'), [])
  const interact = useCallback(() => {
    const result = apiRef.current?.interact()
    if (!result) return
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(result)
    toastTimer.current = setTimeout(() => setToast(null), 6500)
  }, [])

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.repeat) return
      const key = event.key.toLowerCase()
      if (key === 'escape') { event.preventDefault(); setModal(current => current ? null : 'menu'); return }
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return
      if (key === 'm') { event.preventDefault(); setModal(current => current === 'map' ? null : 'map') }
      else if (key === 'f3') { event.preventDefault(); setDebug(current => !current) }
      else if (!modal && key === 'c') toggleCamera()
      else if (!modal && key === 'e') interact()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [modal, interact, toggleCamera])

  useEffect(() => {
    if (modal) apiRef.current?.setVirtual({ moveX: 0, moveZ: 0, sprint: false, jump: false })
  }, [modal])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const night = snapshot.time < 6 || snapshot.time >= 19

  return <main className="elyria-app">
    <div className="world-stage" aria-label="Elyria explorable 3D plaza">
      <SceneBoundary onFailure={setSceneError}><WorldCanvas apiRef={apiRef} onSnapshot={onSnapshot} paused={modal !== null} qualityMode={quality} cameraMode={camera} audioEnabled={audio} /></SceneBoundary>
    </div>
    <div className="scene-vignette" aria-hidden="true" />

    <div className="game-hud">
      <header className="top-bar">
        <div className="wordmark" aria-label="Elyria"><Blossom /><span>ELYRIA</span><i>a little world of wonder</i></div>
        <div className="location-pill"><span className="live-dot" /><span>Blossom Central</span><span className="location-divider" /><Icon name="leaf" size={14} /></div>
        <div className="top-actions">
          <div className="weather-pill"><Icon name={night ? 'moon' : 'sun'} size={19} /><span>{formatTime(snapshot.time)}<small>{night ? 'Clear skies' : 'Sunny'}</small></span></div>
          <button className="icon-button" aria-label={audio ? 'Mute ambience' : 'Enable ambience'} title={audio ? 'Mute ambience' : 'Enable ambience'} aria-pressed={audio} onClick={() => setAudio(current => !current)}><Icon name={audio ? 'sound' : 'muted'} /></button>
          <button className="icon-button" aria-label="Open pause menu" title="Pause menu (Esc)" onClick={() => setModal('menu')}><Icon name="menu" /></button>
        </div>
      </header>

      <div className="world-caption"><span className="eyebrow">WELCOME TO YOUR LITTLE TOMORROW</span><h1>A little wonder,<br /><em>around every corner.</em></h1><p>Take the long way home.</p><div className="caption-rule"><span /><Blossom size={13} /><span /></div></div>

      {snapshot.ready && snapshot.nearLandmark && !modal && <button className="interaction-prompt" onClick={interact}><kbd>E</kbd><span>Look around</span><Icon name="arrow" size={16} /></button>}
      {toast && !modal && <div className="discovery-toast" role="status"><Blossom size={23} /><p>{toast}</p><button aria-label="Dismiss description" onClick={() => setToast(null)}><Icon name="close" size={16} /></button></div>}

      <div className="minimap-block">
        <div className="minimap-actions"><button className="small-button" title="Switch camera (C)" aria-label={camera === 'follow' ? 'Switch to vista camera' : 'Switch to follow camera'} aria-pressed={camera === 'vista'} onClick={toggleCamera}><Icon name="camera" size={17} /><span>{camera === 'follow' ? 'Vista' : 'Follow'}</span></button><span className="exploration-label">{snapshot.discovered.length} places found</span></div>
        <button className="minimap-button" onClick={() => setModal('map')} aria-label="Open Blossom Central map"><WorldMap snapshot={snapshot} /><span className="minimap-north">N</span><span className="minimap-footer"><span><Icon name="compass" size={14} /> Blossom Central</span><kbd>M</kbd></span></button>
      </div>

      <footer className="controls-bar"><div className="control-item"><kbd>W A S D</kbd><span>Explore</span></div><div className="control-item"><kbd>Shift</kbd><span>Sprint</span></div><div className="control-item"><kbd>Space</kbd><span>Jump</span></div><div className="control-item"><kbd>E</kbd><span>Interact</span></div><div className="control-item"><kbd>C</kbd><span>Vista</span></div><div className="control-item"><kbd>M</kbd><span>Map</span></div><div className="camera-hint">Drag to look around</div></footer>
      <TouchControls apiRef={apiRef} disabled={modal !== null} />
    </div>

    {!snapshot.ready && !sceneError && <div className="loading-layer" role="status"><div className="loading-blossom"><Blossom size={44} /></div><p>Preparing your little corner…</p><span>A new day in Elyria</span></div>}

    {debug && <aside className="debug-panel" aria-label="Runtime diagnostics"><div className="debug-heading"><strong>Runtime diagnostics</strong><button aria-label="Close diagnostics" onClick={() => setDebug(false)}><Icon name="close" size={15} /></button></div><dl>
      <dt>FPS / frame</dt><dd>{snapshot.fps.toFixed(0)} / {snapshot.frameMs.toFixed(1)} ms</dd><dt>p95 frame</dt><dd>{snapshot.p95Ms.toFixed(1)} ms</dd><dt>Draws / triangles</dt><dd>{snapshot.drawCalls} / {snapshot.triangles.toLocaleString()}</dd><dt>Backend</dt><dd>{snapshot.backend}</dd><dt>Lighting</dt><dd>{snapshot.lighting}</dd><dt>Ray tracing</dt><dd>Unavailable</dd><dt>Quality / DPR</dt><dd>{snapshot.activeQuality} / {snapshot.renderScale.toFixed(2)}</dd><dt>NPCs / petals</dt><dd>{snapshot.npcCount} / {snapshot.petalCount}</dd><dt>Player XYZ</dt><dd>{snapshot.player.x.toFixed(1)}, {snapshot.player.y.toFixed(1)}, {snapshot.player.z.toFixed(1)}</dd></dl>
      <label>Time <span>{formatTime(snapshot.time)}</span><input type="range" min="0" max="23.99" step="0.1" value={snapshot.time} onChange={event => apiRef.current?.setTime(Number(event.target.value))} /></label>
      <label>Wind <span>{snapshot.wind.toFixed(1)}</span><input type="range" min="0" max="2" step="0.1" value={snapshot.wind} onChange={event => apiRef.current?.setWind(Number(event.target.value))} /></label>
      <button className="small-button debug-reset" onClick={() => apiRef.current?.resetPlayer()}>Return to plaza entrance</button><small>F3 to hide · measured runtime counters</small>
    </aside>}

    {modal === 'menu' && <Dialog title="Stay a little longer." eyebrow="A MOMENT TO YOURSELF" onClose={() => setModal(null)}><p className="dialog-intro">The plaza will be here when you’re ready.</p><div className="menu-section"><label id="quality-label">Visual quality <span>{quality === 'AUTO' ? `Auto · ${snapshot.activeQuality.toLowerCase()}` : quality.toLowerCase()}</span></label><div className="quality-options" role="group" aria-labelledby="quality-label">{QUALITY_MODES.map(mode => <button key={mode} aria-pressed={quality === mode} className={quality === mode ? 'selected' : ''} onClick={() => setQuality(mode)}>{mode.toLowerCase()}</button>)}</div><p className="setting-note">Auto adjusts detail using the scene’s measured frame rate.</p></div><div className="menu-row"><span>Ambient sound<small>Soft tones for a slower afternoon</small></span><button className={`toggle ${audio ? 'on' : ''}`} role="switch" aria-checked={audio} aria-label="Ambient sound" onClick={() => setAudio(current => !current)}><span /></button></div><div className="menu-row"><span>Camera<small>A closer look or a wider perspective</small></span><button className="text-button" onClick={toggleCamera}>{camera === 'follow' ? 'Follow' : 'Vista'} <Icon name="camera" size={16} /></button></div><button className="primary-button resume-button" onClick={() => setModal(null)}>Back to wandering <Icon name="arrow" size={18} /></button><div className="menu-foot"><span>Blossom plaza · Early preview</span><button className="text-button" onClick={() => { setDebug(current => !current); setModal(null) }}>Diagnostics <kbd>F3</kbd></button></div></Dialog>}

    {modal === 'map' && <Dialog title="A place to get a little lost." eyebrow="BLOSSOM CENTRAL" onClose={() => setModal(null)} wide><p className="dialog-intro">A small corner of a bigger tomorrow. Wander over to discover each place.</p><div className="large-map"><WorldMap snapshot={snapshot} expanded /><span className="large-map-north">N ↑</span></div><div className="map-legend"><span><i className="legend-player" /> You are here</span><span><i className="legend-discovered" /> Discovered</span><span><i className="legend-place" /> A place to explore</span></div><p className="map-foot">{snapshot.discovered.length} places discovered <span>Map follows the actual plaza layout</span></p></Dialog>}
  </main>
}
