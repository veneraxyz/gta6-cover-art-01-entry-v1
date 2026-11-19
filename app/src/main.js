// main.js — the Vice Cover Studio editor.
//
// Wires the controls to the cover engine: photo library, per-panel crops
// (drag to position, scroll to zoom), layout / grade / caption controls and
// PNG export at the three post sizes. Photos are read on this machine and
// never leave it.

import {
  EXPORT_SIZES, LAYOUTS, GRADES, gradeById, layoutById, sizeById,
  layoutPanels, panelAt, photoDrawRect, renderCover,
} from './cover.js';
import { applyShotParams } from './shots.js';

const $ = (id) => document.getElementById(id);

const TITLE_COLORS = [
  { id: 'white', value: '#ffffff', label: 'White' },
  { id: 'sun', value: '#ffd60a', label: 'Sun yellow' },
  { id: 'pink', value: '#ff2e88', label: 'Hot pink' },
  { id: 'cyan', value: '#22d3ee', label: 'Neon cyan' },
  { id: 'mint', value: '#7CFC9A', label: 'Mint' },
];

const SAMPLES = [
  { id: 'sample-pier', name: 'Pier', src: 'samples/pier.jpg' },
  { id: 'sample-boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
];

// One photo per panel slot; pan/zoom vary so one photo fills several panels
// with a different crop in each.
function defaultSlots(layoutId, photoId) {
  const count = layoutById(layoutId).panels;
  const pans = [
    { panX: -0.35, panY: -0.15 },
    { panX: 0.35, panY: 0.1 },
    { panX: 0, panY: -0.3 },
    { panX: -0.2, panY: 0.35 },
  ];
  return Array.from({ length: count }, (_, i) => ({
    photoId,
    zoom: 1.12,
    panX: pans[i % pans.length].panX,
    panY: pans[i % pans.length].panY,
  }));
}

const state = {
  layout: 'triptych',
  grade: 'sunset',
  size: '1080x1080',
  title: 'Sunset Heist',
  subtitle: 'Neon Boulevard',
  titleScale: 1,
  titleColor: '#ffffff',
  titleStyle: 'outline',
  // panel slots per layout, so switching layouts keeps each layout's crops
  slotsByLayout: {},
  selectedPanel: 0,
};

const photos = []; // { id, name, image, url? }
let photoCounter = 0;
let previewPanels = [];
let dragging = null; // { panel, lastX, lastY }
let fontsReady = false;

function currentSlots() {
  if (!state.slotsByLayout[state.layout]) {
    state.slotsByLayout[state.layout] = defaultSlots(state.layout, photos[0]?.id ?? null);
  }
  return state.slotsByLayout[state.layout];
}

function coverState() {
  return {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    titleScale: state.titleScale,
    titleColor: state.titleColor,
    titleStyle: state.titleStyle,
    photos,
    panels: currentSlots(),
  };
}

// ---- preview -------------------------------------------------------------

function fitPreviewCanvas() {
  const canvas = $('previewCanvas');
  const wrap = $('previewWrap');
  const size = sizeById(state.size);
  const maxW = Math.min(wrap.clientWidth - 4, 920);
  const maxH = Math.min(window.innerHeight - 210, 860);
  const scale = Math.min(maxW / size.width, maxH / size.height, 1);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(size.width * scale * dpr));
  canvas.height = Math.max(1, Math.round(size.height * scale * dpr));
  canvas.style.width = `${Math.round(size.width * scale)}px`;
  canvas.style.height = `${Math.round(size.height * scale)}px`;
}

function renderPreview() {
  const canvas = $('previewCanvas');
  const ctx = canvas.getContext('2d');
  renderCover(ctx, canvas.width, canvas.height, coverState());
  previewPanels = layoutPanels(state.layout, canvas.width, canvas.height);
  drawPanelSelection(ctx);
  updatePanelBar();
}

function drawPanelSelection(ctx) {
  const rect = previewPanels[state.selectedPanel];
  if (!rect) return;
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = Math.max(3, ctx.canvas.width * 0.004);
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  ctx.setLineDash([]);
  // panel number chip
  const chip = Math.max(26, ctx.canvas.width * 0.032);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(rect.x + 2, rect.y + 2, chip, chip);
  ctx.fillStyle = '#0d0a14';
  ctx.font = `700 ${Math.round(chip * 0.6)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(state.selectedPanel + 1), rect.x + 2 + chip / 2, rect.y + 2 + chip / 2 + 1);
  ctx.restore();
}

function updatePanelBar() {
  const slots = currentSlots();
  const slot = slots[state.selectedPanel];
  const count = layoutById(state.layout).panels;
  const photo = photos.find((p) => p.id === slot?.photoId);
  $('panelHint').textContent = photo
    ? `Panel ${state.selectedPanel + 1} of ${count} — ${photo.name} · drag to position, scroll to zoom`
    : `Panel ${state.selectedPanel + 1} of ${count} — sunset backdrop · pick a photo to fill it`;
  $('zoomRange').value = String(Math.round((slot?.zoom || 1) * 100));
  $('zoomValue').textContent = `${Math.round((slot?.zoom || 1) * 100)}%`;
}

// ---- photos --------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

function addPhotoRecord(id, name, image, url) {
  const record = { id, name, image, url: url ?? null };
  photos.push(record);
  return record;
}

async function addSamplePhoto(sampleId) {
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!sample) return null;
  const existing = photos.find((p) => p.id === sample.id);
  if (existing) return existing;
  const image = await loadImage(sample.src);
  const record = addPhotoRecord(sample.id, sample.name, image);
  renderPhotoLibrary();
  return record;
}

async function addUploadedPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    photoCounter += 1;
    const record = addPhotoRecord(`upload-${photoCounter}`, file.name.replace(/\.[^.]+$/, ''), image, url);
    renderPhotoLibrary();
    return record;
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function renderPhotoLibrary() {
  const library = $('photoLibrary');
  library.innerHTML = '';
  for (const photo of photos) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-thumb';
    button.title = `Use ${photo.name} in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.image.src;
    thumb.alt = photo.name;
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.append(thumb, label);
    button.addEventListener('click', () => {
      assignPhotoToSelectedPanel(photo.id);
    });
    library.append(button);
  }
  $('photoEmpty').style.display = photos.length ? 'none' : 'block';
  $('fillAllPanelsBtn').disabled = photos.length === 0;
}

function assignPhotoToSelectedPanel(photoId) {
  const slots = currentSlots();
  const slot = slots[state.selectedPanel];
  if (!slot) return;
  slot.photoId = photoId;
  slot.zoom = 1.12;
  slot.panX = 0;
  slot.panY = 0;
  renderPreview();
}

function fillAllPanels(photoId) {
  const slots = currentSlots();
  const fresh = defaultSlots(state.layout, photoId);
  slots.forEach((slot, i) => {
    slot.photoId = photoId;
    slot.zoom = fresh[i].zoom;
    slot.panX = fresh[i].panX;
    slot.panY = fresh[i].panY;
  });
  renderPreview();
}

// ---- export --------------------------------------------------------------

async function ensureFonts() {
  if (fontsReady) return;
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch {
    // fall back to the system stack if the font cannot load
  }
  fontsReady = true;
}

async function exportCover(sizeId) {
  const size = sizeById(sizeId);
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, size.width, size.height, coverState());
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob, width: size.width, height: size.height, sizeId: size.id };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportAndDownload() {
  const button = $('exportPngBtn');
  button.disabled = true;
  button.textContent = 'Rendering…';
  try {
    const { blob, sizeId } = await exportCover(state.size);
    downloadBlob(blob, `vice-cover-${sizeId}.png`);
    button.textContent = 'Exported ✓';
    setTimeout(() => { button.textContent = 'Download PNG'; button.disabled = false; }, 1600);
  } catch (error) {
    button.textContent = 'Export failed — try again';
    button.disabled = false;
    console.error('export failed', error);
  }
}

// ---- preview pointer: drag to position, scroll to zoom -------------------

function canvasPoint(event) {
  const canvas = $('previewCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function selectedPhotoAndRect() {
  const slots = currentSlots();
  const slot = slots[state.selectedPanel];
  const rect = previewPanels[state.selectedPanel];
  const photo = photos.find((p) => p.id === slot?.photoId);
  if (!slot || !rect || !photo) return null;
  return { slot, rect, photo };
}

function bindPreviewPointer() {
  const canvas = $('previewCanvas');
  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const hit = panelAt(previewPanels, point.x, point.y);
    if (hit === -1) return;
    state.selectedPanel = hit;
    canvas.setPointerCapture(event.pointerId);
    dragging = { panel: hit, lastX: point.x, lastY: point.y };
    renderPreview();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const point = canvasPoint(event);
    const target = selectedPhotoAndRect();
    if (!target) return;
    const { slot, rect, photo } = target;
    const dest = photoDrawRect(photo.image, rect, slot);
    if (dest.maxPanX > 0) slot.panX += (point.x - dragging.lastX) / dest.maxPanX;
    if (dest.maxPanY > 0) slot.panY += (point.y - dragging.lastY) / dest.maxPanY;
    slot.panX = Math.max(-1, Math.min(1, slot.panX));
    slot.panY = Math.max(-1, Math.min(1, slot.panY));
    dragging.lastX = point.x;
    dragging.lastY = point.y;
    renderPreview();
  });
  const endDrag = () => { dragging = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', () => {
    const target = selectedPhotoAndRect();
    if (!target) return;
    target.slot.zoom = 1.12;
    target.slot.panX = 0;
    target.slot.panY = 0;
    renderPreview();
  });
  canvas.addEventListener('wheel', (event) => {
    const target = selectedPhotoAndRect();
    if (!target) return;
    event.preventDefault();
    target.slot.zoom = Math.max(1, Math.min(3, target.slot.zoom * Math.exp(-event.deltaY * 0.0012)));
    renderPreview();
  }, { passive: false });
}

// ---- controls ------------------------------------------------------------

function markActive(container, button) {
  for (const child of container.children) child.classList.remove('active');
  button.classList.add('active');
}

function buildLayoutPicker() {
  const picker = $('layoutPicker');
  for (const layout of LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-option';
    button.dataset.layout = layout.id;
    button.title = layout.hint;
    const diagram = document.createElement('span');
    diagram.className = `layout-diagram layout-${layout.id}`;
    for (let i = 0; i < layout.panels; i += 1) diagram.append(document.createElement('i'));
    const label = document.createElement('span');
    label.className = 'layout-name';
    label.textContent = layout.name;
    button.append(diagram, label);
    button.addEventListener('click', () => {
      state.layout = layout.id;
      state.selectedPanel = 0;
      markActive(picker, button);
      renderPreview();
    });
    picker.append(button);
  }
}

function buildGradePicker() {
  const picker = $('gradePicker');
  for (const grade of GRADES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-option';
    button.dataset.grade = grade.id;
    button.title = grade.name;
    button.style.background = `linear-gradient(135deg, ${grade.skyTop}, ${grade.skyMid} 55%, ${grade.skyBottom})`;
    const label = document.createElement('span');
    label.textContent = grade.name;
    button.append(label);
    button.addEventListener('click', () => {
      state.grade = grade.id;
      markActive(picker, button);
      renderPreview();
    });
    picker.append(button);
  }
}

function buildTitleColorPicker() {
  const picker = $('titleColorPicker');
  for (const color of TITLE_COLORS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-swatch';
    button.dataset.color = color.value;
    button.title = color.label;
    button.style.background = color.value;
    button.setAttribute('aria-label', color.label);
    button.addEventListener('click', () => {
      state.titleColor = color.value;
      markActive(picker, button);
      renderPreview();
    });
    picker.append(button);
  }
}

function buildSizePicker() {
  const picker = $('sizePicker');
  for (const size of EXPORT_SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-option';
    button.dataset.size = size.id;
    const label = document.createElement('span');
    label.className = 'size-label';
    label.textContent = size.label;
    const detail = document.createElement('span');
    detail.className = 'size-detail';
    detail.textContent = size.detail;
    button.append(label, detail);
    button.addEventListener('click', () => {
      state.size = size.id;
      markActive(picker, button);
      fitPreviewCanvas();
      renderPreview();
    });
    picker.append(button);
  }
}

function bindCaptionControls() {
  $('captionTitleInput').addEventListener('input', (event) => {
    state.title = event.target.value;
    renderPreview();
  });
  $('captionSubtitleInput').addEventListener('input', (event) => {
    state.subtitle = event.target.value;
    renderPreview();
  });
  $('captionSizeRange').addEventListener('input', (event) => {
    state.titleScale = Number(event.target.value) / 100;
    $('captionSizeValue').textContent = `${event.target.value}%`;
    renderPreview();
  });
  for (const button of document.querySelectorAll('[data-title-style]')) {
    button.addEventListener('click', () => {
      state.titleStyle = button.dataset.titleStyle;
      markActive($('titleStylePicker'), button);
      renderPreview();
    });
  }
}

function bindPhotoControls() {
  $('photoFileInput').addEventListener('change', async (event) => {
    for (const file of event.target.files) {
      const record = await addUploadedPhoto(file);
      if (record) assignPhotoToSelectedPanel(record.id);
    }
    event.target.value = '';
  });
  $('samplePierBtn').addEventListener('click', async () => {
    const record = await addSamplePhoto('sample-pier');
    if (record) assignPhotoToSelectedPanel(record.id);
  });
  $('sampleBoulevardBtn').addEventListener('click', async () => {
    const record = await addSamplePhoto('sample-boulevard');
    if (record) assignPhotoToSelectedPanel(record.id);
  });
  $('fillAllPanelsBtn').addEventListener('click', () => {
    const slots = currentSlots();
    const slot = slots[state.selectedPanel];
    const photoId = slot?.photoId ?? photos[0]?.id;
    if (photoId) fillAllPanels(photoId);
  });

  // drag and drop onto the preview
  const wrap = $('previewWrap');
  const hint = $('dropHint');
  const showHint = (event) => { event.preventDefault(); hint.classList.add('visible'); };
  const hideHint = (event) => { event.preventDefault(); hint.classList.remove('visible'); };
  wrap.addEventListener('dragenter', showHint);
  wrap.addEventListener('dragover', showHint);
  wrap.addEventListener('dragleave', hideHint);
  wrap.addEventListener('drop', async (event) => {
    hideHint(event);
    for (const file of event.dataTransfer.files) {
      const record = await addUploadedPhoto(file);
      if (record) assignPhotoToSelectedPanel(record.id);
    }
  });
}

function bindPanelBar() {
  $('zoomRange').addEventListener('input', (event) => {
    const target = selectedPhotoAndRect();
    if (!target) return;
    target.slot.zoom = Number(event.target.value) / 100;
    renderPreview();
  });
  $('resetCropBtn').addEventListener('click', () => {
    const target = selectedPhotoAndRect();
    if (!target) return;
    target.slot.zoom = 1.12;
    target.slot.panX = 0;
    target.slot.panY = 0;
    renderPreview();
  });
}

// ---- init ----------------------------------------------------------------

function markDefaultsActive() {
  const layoutBtn = document.querySelector(`[data-layout="${state.layout}"]`);
  if (layoutBtn) layoutBtn.classList.add('active');
  const gradeBtn = document.querySelector(`[data-grade="${state.grade}"]`);
  if (gradeBtn) gradeBtn.classList.add('active');
  const colorBtn = document.querySelector(`[data-color="${state.titleColor}"]`);
  if (colorBtn) colorBtn.classList.add('active');
  const sizeBtn = document.querySelector(`[data-size="${state.size}"]`);
  if (sizeBtn) sizeBtn.classList.add('active');
  const styleBtn = document.querySelector(`[data-title-style="${state.titleStyle}"]`);
  if (styleBtn) styleBtn.classList.add('active');
}

async function init() {
  buildLayoutPicker();
  buildGradePicker();
  buildTitleColorPicker();
  buildSizePicker();
  bindCaptionControls();
  bindPhotoControls();
  bindPanelBar();
  bindPreviewPointer();
  $('exportPngBtn').addEventListener('click', exportAndDownload);
  markDefaultsActive();

  // The app opens on a finished-looking cover: the pier sample in every
  // panel, each with its own crop. One click swaps in the user's own photo.
  await ensureFonts();
  const pier = await addSamplePhoto('sample-pier');
  if (pier) fillAllPanels(pier.id);

  fitPreviewCanvas();
  renderPreview();
  window.addEventListener('resize', () => { fitPreviewCanvas(); renderPreview(); });

  // Screenshot automation (?shot=editor / ?shot=cover) for the entry shots.
  const shotApi = {
    state,
    photos,
    addSamplePhoto,
    assignPhotoToSelectedPanel,
    fillAllPanels,
    setLayout(layoutId) {
      state.layout = layoutId;
      state.selectedPanel = 0;
      const btn = document.querySelector(`[data-layout="${layoutId}"]`);
      if (btn) markActive($('layoutPicker'), btn);
    },
    setGrade(gradeId) {
      state.grade = gradeId;
      const btn = document.querySelector(`[data-grade="${gradeId}"]`);
      if (btn) markActive($('gradePicker'), btn);
    },
    setSize(sizeId) {
      state.size = sizeId;
      const btn = document.querySelector(`[data-size="${sizeId}"]`);
      if (btn) markActive($('sizePicker'), btn);
      fitPreviewCanvas();
    },
    setCaption(title, subtitle) {
      if (title !== null) {
        state.title = title;
        $('captionTitleInput').value = title;
      }
      if (subtitle !== null) {
        state.subtitle = subtitle;
        $('captionSubtitleInput').value = subtitle;
      }
    },
    renderPreview,
  };
  await applyShotParams(shotApi);
  renderPreview();
  window.__shotReady = true;

  // Handle for scripted checks and screenshots.
  window.__coverApp = {
    state,
    photos,
    exportCover,
    renderPreview,
    addSamplePhoto,
    assignPhotoToSelectedPanel,
    fillAllPanels,
  };
}

init();
