'use strict';

// ---------- Configuración y estado ----------
const STORE_KEY = 'cargo-hibrido:v1';
const DEFAULTS = { gasL: 6.0, kwh: 18, gasPrice: 1.60, loss: 10, maxPrice: 1.00 };
const GAP = 24;          // hueco (grados) arriba del dial, como las 12 de un reloj
const R = 160;           // radio del arco

let cfg = null;
let price = 0.35;
let dragging = false;
let lastFrac = null;
let lastGreen = null;

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

const fmt = (n, d = 2) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const parseNum = (s) => {
  const n = parseFloat(String(s).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.cfg) { cfg = s.cfg; }
    if (s && Number.isFinite(s.price)) { price = s.price; }
  } catch (_) { /* sin almacenamiento: seguimos con valores por defecto */ }
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ cfg, price })); } catch (_) {}
}

// ---------- Cálculos ----------
const efficiency = (c) => 1 - c.loss / 100;
const thresholdPrice = (c) => (c.gasL * c.gasPrice * efficiency(c)) / c.kwh;
function costs(c, p) {
  const gas = c.gasL * c.gasPrice;
  const el = (c.kwh * p) / efficiency(c);
  return { gas, el, diff: gas - el };
}

// ---------- Geometría del dial ----------
const fracToAngle = (f) => GAP / 2 + f * (360 - GAP);
function point(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}
function arcPath(f0, f1, r) {
  if (f1 - f0 < 0.0005) return '';
  const a0 = fracToAngle(f0), a1 = fracToAngle(f1);
  const [x0, y0] = point(a0, r), [x1, y1] = point(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function buildScale() {
  const ticks = $('ticks'), labels = $('labels');
  ticks.textContent = '';
  labels.textContent = '';
  const max = cfg.maxPrice;
  const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5];
  const labelStep = steps.find((s) => max / s <= 12) || 10;
  const minor = labelStep / 5;
  const n = Math.round(max / minor);
  for (let i = 0; i <= n; i++) {
    const v = i * minor;
    if (v > max + 1e-9) break;
    const major = i % 5 === 0;
    const a = fracToAngle(v / max);
    const [x0, y0] = point(a, 140);
    const [x1, y1] = point(a, major ? 124 : 132);
    el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? 'tick major' : 'tick' }, ticks);
    if (major) {
      const [lx, ly] = point(a, 195);
      const t = el('text', { x: lx, y: ly, class: 'lbl', 'data-angle': a }, labels);
      t.textContent = fmt(v, labelStep < 0.1 ? 2 : labelStep < 1 ? 1 : 0);
    }
  }
}

function renderThreshold() {
  const th = thresholdPrice(cfg);
  const tf = Math.min(th / cfg.maxPrice, 1);
  $('arcGreen').setAttribute('d', arcPath(0, tf, R));
  $('arcRed').setAttribute('d', arcPath(tf, 1, R));
  $('thresholdValue').textContent = fmt(th) + ' €';

  const marker = $('thresholdMarker');
  const a = fracToAngle(tf);
  for (const t of $('labels').children) {
    const near = th < cfg.maxPrice && Math.abs(parseFloat(t.dataset.angle) - a) < 10;
    t.style.opacity = near ? '0' : '';
  }
  if (th >= cfg.maxPrice) { marker.style.display = 'none'; return; }
  marker.style.display = '';
  const [x0, y0] = point(a, 138), [x1, y1] = point(a, 182);
  const line = $('thLine');
  line.setAttribute('x1', x0); line.setAttribute('y1', y0);
  line.setAttribute('x2', x1); line.setAttribute('y2', y1);
  const tip = point(a, 186), l = point(a - 4, 204), r = point(a + 4, 204);
  $('thTri').setAttribute('points', [tip, l, r].map((p) => p.join(',')).join(' '));
}

function render() {
  const { gas, el: elc, diff } = costs(cfg, price);
  const green = diff >= 0;

  document.body.classList.toggle('is-green', green);
  document.body.classList.toggle('is-red', !green);

  const f = Math.min(Math.max(price / cfg.maxPrice, 0), 1);
  const [kx, ky] = point(fracToAngle(f), R);
  const knob = $('knob');
  knob.setAttribute('cx', kx);
  knob.setAttribute('cy', ky);

  $('priceValue').textContent = fmt(price);
  $('verdict').textContent = green ? 'CARGA' : 'GASOLINA';
  $('savings').textContent = green
    ? `Ahorras ${fmt(diff)} €/100 km`
    : `Pierdes ${fmt(-diff)} €/100 km`;
  $('gasCost').textContent = fmt(gas) + ' €';
  $('elCost').textContent = fmt(elc) + ' €';

  const dial = $('dial');
  dial.setAttribute('aria-valuemax', cfg.maxPrice);
  dial.setAttribute('aria-valuenow', price);
  dial.setAttribute('aria-valuetext', `${fmt(price)} €/kWh: ${green ? 'carga' : 'gasolina'}`);

  if (lastGreen !== null && lastGreen !== green && navigator.vibrate) navigator.vibrate(25);
  lastGreen = green;
}

function setPrice(p) {
  price = Math.max(0, Math.round(p * 100) / 100);
  render();
}

// ---------- Interacción con el dial ----------
function pointerFrac(e) {
  const rect = $('dialSvg').getBoundingClientRect();
  const x = e.clientX - (rect.left + rect.width / 2);
  const y = e.clientY - (rect.top + rect.height / 2);
  let a = (Math.atan2(x, -y) * 180) / Math.PI;
  if (a < 0) a += 360;
  let f = (a - GAP / 2) / (360 - GAP);
  if (f < 0 || f > 1) {
    // dentro del hueco superior: pegar al extremo más cercano / al que veníamos
    f = lastFrac !== null ? (lastFrac > 0.5 ? 1 : 0) : (f < 0 ? 0 : 1);
  }
  // evitar saltar de máximo a 0 (o al revés) al cruzar el hueco arrastrando
  if (lastFrac !== null && Math.abs(f - lastFrac) > 0.5) f = lastFrac > 0.5 ? 1 : 0;
  lastFrac = f;
  return f;
}

function initDial() {
  const svg = $('dialSvg');
  svg.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastFrac = null;
    svg.setPointerCapture(e.pointerId);
    setPrice(pointerFrac(e) * cfg.maxPrice);
  });
  svg.addEventListener('pointermove', (e) => {
    if (dragging) setPrice(pointerFrac(e) * cfg.maxPrice);
  });
  const end = () => { if (dragging) { dragging = false; saveState(); } };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  const dial = $('dial');
  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    setPrice(price + (e.deltaY < 0 ? 0.01 : -0.01));
    saveState();
  }, { passive: false });
  dial.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01 }[e.key];
    if (d) { e.preventDefault(); setPrice(price + d); saveState(); }
  });

  // Tocar el centro: escribir el precio a mano
  const dlg = $('priceDialog');
  $('center').addEventListener('click', () => {
    $('priceInput').value = fmt(price);
    dlg.showModal();
    $('priceInput').select();
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    const p = parseNum($('priceInput').value);
    if (p >= 0) { setPrice(p); saveState(); }
  });
}

// ---------- Ajustes ----------
const FIELDS = ['gasL', 'kwh', 'gasPrice', 'loss', 'maxPrice'];

function readForm() {
  const form = $('settingsForm');
  const c = {};
  for (const k of FIELDS) c[k] = parseNum(form.elements[k].value);
  if (!(c.gasL > 0)) return [null, 'Consumo de gasolina no válido.'];
  if (!(c.kwh > 0)) return [null, 'Consumo eléctrico no válido.'];
  if (!(c.gasPrice > 0)) return [null, 'Precio de gasolina no válido.'];
  if (!(c.loss >= 0 && c.loss < 60)) return [null, 'Las pérdidas deben estar entre 0 y 60 %.'];
  if (!(c.maxPrice > 0)) return [null, 'Máximo del dial no válido.'];
  return [c, ''];
}

function updatePreview() {
  const [c] = readForm();
  $('previewText').innerHTML = c
    ? `Con estos datos compensa cargar hasta <strong>${fmt(thresholdPrice(c))} €/kWh</strong>`
    : '';
}

function openSettings(firstRun = false) {
  const form = $('settingsForm');
  const src = cfg || DEFAULTS;
  for (const k of FIELDS) {
    form.elements[k].value = src[k].toLocaleString('es-ES', { maximumFractionDigits: 3, useGrouping: false });
  }
  $('firstRunNote').hidden = !firstRun;
  $('cancelSettings').hidden = firstRun;
  $('formError').textContent = '';
  updatePreview();
  $('mainView').hidden = true;
  $('settingsView').hidden = false;
}

function closeSettings() {
  $('settingsView').hidden = true;
  $('mainView').hidden = false;
}

function initSettings() {
  $('openSettings').addEventListener('click', () => openSettings(false));
  $('cancelSettings').addEventListener('click', closeSettings);
  $('settingsForm').addEventListener('input', updatePreview);
  $('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const [c, err] = readForm();
    if (!c) { $('formError').textContent = err; return; }
    cfg = c;
    saveState();
    buildScale();
    renderThreshold();
    lastGreen = null;
    render();
    closeSettings();
  });
}

// ---------- Arranque ----------
loadState();
initDial();
initSettings();
if (cfg) {
  buildScale();
  renderThreshold();
  render();
} else {
  cfg = { ...DEFAULTS };
  buildScale();
  renderThreshold();
  render();
  cfg = null;
  openSettings(true);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
