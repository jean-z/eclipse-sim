import { useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  sunEcliptic, moonEcliptic, eclipseGeometry,
  KM_PER_AU, R_SUN, R_EARTH, R_MOON,
} from '../astro/ephemeris.js'

// 场景比例：1 单位 = 1000 千米。地月距离/半径用真实值；
// 太阳在真实方向上拉远到 4000 单位并放大显示（真实距离下太阳不可见）。
const U = 1 / 1000;                     // km → unit
const SUN_DIST = 4000;                  // 显示距离（单位）
const SUN_VIS_R = 62;                   // 显示半径
const MOON_UMBRA_LEN_KM = 379000;       // 月球本影平均长度（真实量级，见 README）

/* ── 程序化贴图（离线可用，无外部素材）────────────────────────────── */
function texEarth() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0e3f7a'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = ['#2e7d43', '#3c8a4f', '#6a9a4b', '#c8c2a6'][i % 4];
    const x = Math.random() * 512, y = 40 + Math.random() * 176, r = 14 + Math.random() * 46;
    g.beginPath();
    for (let a = 0; a <= 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      const rr = r * (0.6 + Math.random() * 0.55);
      a === 0 ? g.moveTo(x + rr * Math.cos(t), y + rr * Math.sin(t) * 0.6)
              : g.lineTo(x + rr * Math.cos(t), y + rr * Math.sin(t) * 0.6);
    }
    g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 7; i++) { const x = Math.random() * 512; g.beginPath(); g.ellipse(x, y0(i), 46, 15, 0, 0, 7); g.fill(); }
  function y0(i) { return i % 2 ? 26 : 230; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texMoon() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a96'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${70 + Math.random() * 50 | 0},${70 + Math.random() * 50 | 0},${70 + Math.random() * 50 | 0},${0.25 + Math.random() * 0.4})`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 128, 2 + Math.random() * 11, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texGlow(color = '255,230,160') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, `rgba(${color},1)`);
  rg.addColorStop(0.25, `rgba(${color},.55)`);
  rg.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* 黄道坐标 → 场景坐标（km 数组）→ 单位向量/位置 */
function eclToScene(lonDeg, latDeg, rKm) {
  const l = lonDeg * Math.PI / 180, b = latDeg * Math.PI / 180;
  const x = rKm * Math.cos(b) * Math.cos(l);
  const y = rKm * Math.cos(b) * Math.sin(l);
  const z = rKm * Math.sin(b);
  return new THREE.Vector3(x * U, z * U, -y * U); // 黄道面贴 XZ，北黄极 +Y
}

export default function SceneCanvas({ ref }) {
  const mountRef = useRef(null);
  const s = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.05, 60000);
    camera.position.set(0, 95, 190);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 8.5; controls.maxDistance = 12000;

    // 光照：太阳方向光 + 微环境光
    const sunLight = new THREE.DirectionalLight(0xfff2dc, 2.4);
    scene.add(sunLight, new THREE.AmbientLight(0x223344, 0.55));

    // 太阳（真实方向、放大显示）
    const sunGroup = new THREE.Group();
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texGlow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sunSprite.scale.setScalar(SUN_VIS_R * 7);
    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_VIS_R, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    );
    sunGroup.add(sunSprite, sunBall);
    scene.add(sunGroup);

    // 地球 + 大气边缘
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH * U, 64, 48),
      new THREE.MeshPhongMaterial({ map: texEarth(), shininess: 14, specular: 0x223344 }),
    );
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH * U * 1.045, 48, 36),
      new THREE.MeshBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scene.add(earth, atmo);

    // 月球
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(R_MOON * U, 48, 32),
      new THREE.MeshPhongMaterial({ map: texMoon(), shininess: 4 }),
    );
    scene.add(moon);

    // 月球公转轨迹（当前历元真实采样的一个月）
    const monthPts = [];
    const jd0 = 2460400.5;
    for (let i = 0; i <= 240; i++) {
      const m = moonEcliptic(jd0 + (i / 240) * 27.32);
      monthPts.push(eclToScene(m.lon, m.lat, m.rKm));
    }
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(monthPts),
      new THREE.LineBasicMaterial({ color: 0x5f86a8, transparent: true, opacity: 0.4 }),
    );
    scene.add(orbitLine);

    // 阴影锥工具函数：底半径 r0、顶半径 r1、长 len 的锥台，轴沿 +Y，使用时再定向
    function cone(r0, r1, len, color, opacity) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r1 * U, r0 * U, len * U, 48, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
      );
      scene.add(m);
      return m;
    }
    // 月球本影（指向背日面，尖端在外）与半影；地影（月食用）
    const moonUmbra = cone(R_MOON, 0.5, MOON_UMBRA_LEN_KM, 0x000000, 0.5);
    const moonPenumbra = cone(R_MOON, R_MOON + 384400 * (R_SUN + R_MOON) / (1.496e8 - 384400), 384400 + 60, 0x223344, 0.16);
    const earthUmbra = cone(R_EARTH, 0.5, (1.496e8 - 384400) * R_EARTH / (R_SUN - R_EARTH), 0x0a1020, 0.42);
    const earthPenumbra = cone(R_EARTH, R_EARTH + 384400 * (R_SUN + R_EARTH) / 1.496e8, 500, 0x223344, 0.14);

    // 日食本影落在地表的暗斑
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85 }),
    );
    scene.add(spot);

    // 星空
    {
      const n = 1600, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(22000);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe4ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.8 })));
    }

    // 尺寸自适应
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    s.current = {
      renderer, scene, camera, controls, sunLight, sunGroup, sunSprite, sunBall,
      earth, atmo, moon, moonUmbra, moonPenumbra, earthUmbra, earthPenumbra, spot,
      viewMode: 'system',
    };

    let raf;
    const tick = () => {
      controls.target.copy(s.current.targetWorld ?? new THREE.Vector3());
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    /** 每帧调用：jdMs = 仿真时刻（ms epoch） */
    update(jdMs) {
      const st = s.current;
      if (!st) return;
      const jd = jdMs / 86400000 + 2440587.5;
      const sun = sunEcliptic(jd);
      const moon = moonEcliptic(jd);

      // 太阳位置（真实方向、放大距离）
      const sunDir = eclToScene(sun.lon, 0, 1).normalize();
      st.sunGroup.position.copy(sunDir).multiplyScalar(SUN_DIST);
      st.sunLight.position.copy(sunDir).multiplyScalar(300);

      // 月球位置
      const moonPos = eclToScene(moon.lon, moon.lat, moon.rKm);
      st.moon.position.copy(moonPos);

      // 背日方向（地心 → 太阳的反向）
      const antiSun = sunDir.clone().negate();

      // 定向阴影锥：CylinderGeometry 轴沿 +Y → 四元数把 +Y 转到 antiSun
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), antiSun);
      st.moonUmbra.quaternion.copy(q);
      st.moonUmbra.position.copy(moonPos).addScaledVector(antiSun, (MOON_UMBRA_LEN_KM * U) / 2);
      st.moonPenumbra.quaternion.copy(q);
      st.moonPenumbra.position.copy(moonPos).addScaledVector(antiSun, ((384400 + 60) * U) / 2);
      st.earthUmbra.quaternion.copy(q);
      st.earthUmbra.position.copy(antiSun).multiplyScalar(((1.496e8 - 384400) * R_EARTH / (R_SUN - R_EARTH) * U) / 2);
      st.earthPenumbra.quaternion.copy(q);
      st.earthPenumbra.position.copy(antiSun).multiplyScalar((500 * U) / 2);

      // 月食着色：月球中心到地影轴的瞄准距离
      const tAxis = -moonPos.dot(antiSun);
      const missLunar = moonPos.clone().addScaledVector(antiSun, tAxis).length() / U; // km
      const shrink = moon.rKm * (R_SUN - R_EARTH) / (sun.r * KM_PER_AU);
      const penumbraR = R_EARTH + shrink;
      const depth = Math.max(0, Math.min(1, 1 - missLunar / (penumbraR + R_MOON)));
      st.moon.material.color.setRGB(1, 1 - depth * 0.75, 1 - depth * 0.85);

      // 日食本影暗斑：本影轴与地表交点
      const tSurf = -moonPos.dot(antiSun);
      const closest = moonPos.clone().addScaledVector(antiSun, tSurf).length();
      const R = R_EARTH * U;
      if (closest < R * 1.25) {
        const along = tSurf - Math.sqrt(Math.max(0, R * R - closest * closest));
        const p = moonPos.clone().addScaledVector(antiSun, along);
        const missKm = closest / U;
        st.spot.visible = missKm < R_EARTH + 3600;
        st.spot.position.copy(p.clone().normalize().multiplyScalar(R * 1.01));
        const fr = Math.max(0.12, 1 - missKm / (R_EARTH + 3600));
        st.spot.scale.setScalar(0.4 + fr * 2.6);
      } else {
        st.spot.visible = false;
      }
    },
    setView(mode) {
      const st = s.current;
      st.viewMode = mode;
      st.targetWorld = mode === 'moon' ? (st.moon?.position ?? new THREE.Vector3()) : new THREE.Vector3();
      if (mode === 'moon') st.camera.position.set(0, 6, 16);
      else st.camera.position.set(0, 95, 190);
    },
  }), []);

  return <div ref={mountRef} id="scene" />;
}
