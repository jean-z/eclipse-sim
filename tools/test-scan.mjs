// 食扫描器回归测试：node tools/test-scan.mjs
// 校验基准（NASA 日月食目录的公开日期）：
//   2027-02-06 日环食（南极洲附近） · 2027-08-02 日全食（埃及/利比亚）
//   2027-02-20 半影月食 · 2027-08-17 月偏食 —— 低精度模型允许 ±1 天与类型边缘差异
import { scanNextEclipse } from '../src/astro/ephemeris.js';

const now = Date.now();
for (const kind of ['solar', 'lunar']) {
  console.log(`\n=== ${kind === 'solar' ? '日食' : '月食'}序列 ===`);
  let cursor = now;
  for (let i = 0; i < 4; i++) {
    const ev = scanNextEclipse(cursor, kind, 1200);
    if (!ev) { console.log('  （窗口内未找到）'); break; }
    const d = new Date(ev.ms);
    console.log(`  ${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}Z  ${ev.event}  轴心距 ${Math.round(ev.miss).toLocaleString('en-US')} km`);
    cursor = ev.ms + 86400000;
  }
}
