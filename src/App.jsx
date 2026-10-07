import { useEffect, useRef } from 'react'
import SceneCanvas from './components/SceneCanvas.jsx'
import Hud from './components/Hud.jsx'
import Controls from './components/Controls.jsx'

export default function App() {
  const sceneRef = useRef(null)
  const hudRef = useRef(null)
  const time = useRef({ simMs: Date.now(), rate: 60, playing: true, last: performance.now() })

  /* 唯一 rAF 主循环：推进仿真时钟 → 命令式驱动场景与面板 */
  useEffect(() => {
    let raf
    const loop = (now) => {
      const t = time.current
      const dt = Math.min(0.1, (now - t.last) / 1000)
      t.last = now
      if (t.playing) t.simMs += dt * t.rate * 1000
      sceneRef.current?.update(t.simMs)
      hudRef.current?.update(t.simMs)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const apiRef = useRef({
    setPlaying(p) { time.current.playing = p },
    setRate(v) { time.current.rate = v },
    goToday() { time.current.simMs = Date.now(); time.current.rate = 1 },
    async jumpToEclipse(kind) {
      const { scanNextEclipse } = await import('./astro/ephemeris.js')
      // 从 2 天前起扫：确保能命中"正在进行"的食
      const ev = scanNextEclipse(time.current.simMs - 2 * 86400000, kind)
      if (ev) time.current.simMs = ev.ms
      return ev
    },
    setView(m) { sceneRef.current?.setView(m) },
  })

  return (
    <>
      <SceneCanvas ref={sceneRef} />
      <Hud ref={hudRef} />
      <Controls apiRef={apiRef} />
    </>
  )
}
