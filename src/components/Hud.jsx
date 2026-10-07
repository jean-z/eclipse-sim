import { useImperativeHandle, useRef } from 'react'
import { dateToJD, eclipseGeometry, moonPhaseName } from '../astro/ephemeris.js'

/** 左上信息面板：仿真时刻 / 月相 / 日月角距 / 食判定（命令式刷新，不走 React 重渲染） */
export default function Hud({ ref }) {
  const date = useRef(null), phase = useRef(null), sepEl = useRef(null),
    lat = useRef(null), solar = useRef(null), lunar = useRef(null)

  useImperativeHandle(ref, () => ({
    update(simMs) {
      const jd = dateToJD(simMs)
      const g = eclipseGeometry(jd)
      const d = new Date(simMs)
      date.current.textContent = d.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
      // 增亏方向：黄经差在 0~180 之间为盈（新月→满月）
      const waxing = ((g.moon.lon - g.sun.lon + 360) % 360) < 180
      phase.current.textContent = `${moonPhaseName(g.sep, waxing)}　照明 ${(g.illum * 100).toFixed(1)}%`
      sepEl.current.textContent = `${g.sep.toFixed(2)}°`
      lat.current.textContent = `${g.moon.lat >= 0 ? '+' : ''}${g.moon.lat.toFixed(3)}°`
      setEvent(solar.current, g.solar)
      setEvent(lunar.current, g.lunar)
    },
  }), [])

  function setEvent(el, ev) {
    if (ev?.event) {
      el.textContent = `${ev.event}（轴心距地心 ${Math.round(ev.miss).toLocaleString('zh-CN')} km，近似判定）`
      el.className = 'ev hit'
    } else if (ev) {
      el.textContent = `无食 · 轴心偏离 ${Math.round(ev.miss).toLocaleString('zh-CN')} km`
      el.className = 'ev miss'
    } else {
      el.textContent = '—— 不在新月/满月窗口'
      el.className = 'ev na'
    }
  }

  return (
    <aside id="hud">
      <h1>日月食模拟器</h1>
      <p className="hud-date" ref={date}>——</p>
      <div className="hud-grid">
        <span className="k">月相</span><span ref={phase}>——</span>
        <span className="k">日月角距</span><span ref={sepEl}>——</span>
        <span className="k">月球黄纬</span><span ref={lat}>——</span>
      </div>
      <div className="ev-block">
        <span className="k">日食判定</span><span className="ev" ref={solar}>——</span>
        <span className="k">月食判定</span><span className="ev" ref={lunar}>——</span>
      </div>
      <p className="hud-note">地心近似判定（Schlyter/Meeus 低精度星历），时刻误差可达数十分钟</p>
    </aside>
  )
}
