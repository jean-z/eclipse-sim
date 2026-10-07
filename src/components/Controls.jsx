import { useState } from 'react'

const SPEEDS = [
  ['实时', 1],
  ['1分/秒', 60],
  ['1时/秒', 3600],
  ['1天/秒', 86400],
]

/** 底部时间控制条 */
export default function Controls({ apiRef }) {
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(60)
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)

  function toggle() { setPlaying((p) => { apiRef.current?.setPlaying(!p); return !p }) }
  function setRate(v) { setSpeed(v); apiRef.current?.setRate(v) }

  async function jump(kind) {
    setBusy(kind)
    const ev = await apiRef.current?.jumpToEclipse(kind)
    setBusy(null)
    // 注意：绝不能用 alert()——阻塞主线程且无人能点掉
    setToast(ev ? `已跳至 ${new Date(ev.ms).toLocaleDateString('zh-CN')} · ${ev.event}` : '800 天内未扫到（可扩大扫描窗口）')
    setTimeout(() => setToast(null), 4000)
    if (ev) { setPlaying(true); setSpeed(60); apiRef.current?.setRate(60) }
  }

  return (
    <div id="controls">
      {toast && <span id="toast">{toast}</span>}
      <button className="ctl play" onClick={toggle}>{playing ? '⏸ 暂停' : '▶ 播放'}</button>
      <div className="sep" />
      {SPEEDS.map(([label, v]) => (
        <button key={v} className={`ctl ${speed === v ? 'on' : ''}`} onClick={() => setRate(v)}>{label}</button>
      ))}
      <div className="sep" />
      <button className="ctl jump" disabled={busy} onClick={() => jump('solar')}>
        {busy === 'solar' ? '扫描中…' : '🌘 下一次日食'}
      </button>
      <button className="ctl jump" disabled={busy} onClick={() => jump('lunar')}>
        {busy === 'lunar' ? '扫描中…' : '🌕 下一次月食'}
      </button>
      <button className="ctl" onClick={() => { apiRef.current?.goToday(); setSpeed(1); setPlaying(true) }}>回到今天</button>
      <div className="sep" />
      <button className="ctl" onClick={() => apiRef.current?.setView('system')}>地月全局</button>
      <button className="ctl" onClick={() => apiRef.current?.setView('moon')}>月球特写</button>
    </div>
  )
}
