// cover.js — the cover art engine for Vice Cover Studio.
//
// Pure canvas drawing: multi-panel layouts, photo crops, neon colour grades,
// a procedural sunset backdrop (drawn in code, no image needed) and the bold
// caption lettering. No DOM, no network — the same code draws the live
// preview and the exported PNG, so what you see is what you share.

export const GUTTER_COLOR = '#f4eee1';
export const PANEL_EDGE = '#160a24';

export const EXPORT_SIZES = [
  { id: '1080x1080', width: 1080, height: 1080, label: 'Square', detail: '1080 × 1080' },
  { id: '1080x1350', width: 1080, height: 1350, label: 'Portrait', detail: '1080 × 1350' },
  { id: '1920x1080', width: 1920, height: 1080, label: 'Wide', detail: '1920 × 1080' },
];

export const LAYOUTS = [
  { id: 'triptych', name: 'Triptych', panels: 3, hint: 'One hero panel, two below' },
  { id: 'split', name: 'Split', panels: 2, hint: 'Two panels, side by side' },
  { id: 'quad', name: 'Quad', panels: 4, hint: 'Four panels in a grid' },
];

// Each grade tints the photos (overlay gradient + tint + canvas filter) and
// colours the procedural sunset backdrop and the subtitle accent.
export const GRADES = [
  {
    id: 'sunset', name: 'Sunset',
    overlayTop: 'rgba(255,140,40,0.34)', overlayBottom: 'rgba(255,45,110,0.36)',
    overlayBlend: 'soft-light', tint: '#ff7a18', tintAlpha: 0.09, tintBlend: 'multiply',
    filter: 'saturate(1.25) contrast(1.06) brightness(1.02)',
    skyTop: '#2b1055', skyMid: '#ff5e62', skyBottom: '#ffb347',
    sun: '#ffd166', sea: '#7a1e5e', accent: '#ffd166',
  },
  {
    id: 'neon', name: 'Neon Nights',
    overlayTop: 'rgba(255,0,128,0.38)', overlayBottom: 'rgba(0,229,255,0.38)',
    overlayBlend: 'overlay', tint: '#7b2fff', tintAlpha: 0.12, tintBlend: 'multiply',
    filter: 'saturate(1.40) contrast(1.08) brightness(1.00)',
    skyTop: '#0b0033', skyMid: '#b537f2', skyBottom: '#ff2e88',
    sun: '#22d3ee', sea: '#1b0b4d', accent: '#22d3ee',
  },
  {
    id: 'ultraviolet', name: 'Ultraviolet',
    overlayTop: 'rgba(124,58,237,0.34)', overlayBottom: 'rgba(236,72,153,0.28)',
    overlayBlend: 'soft-light', tint: '#6d28d9', tintAlpha: 0.12, tintBlend: 'multiply',
    filter: 'saturate(1.20) contrast(1.05) brightness(1.01)',
    skyTop: '#12002b', skyMid: '#5b21b6', skyBottom: '#c026d3',
    sun: '#f0abfc', sea: '#2e1065', accent: '#e879f9',
  },
  {
    id: 'dusk', name: 'Palm Dusk',
    overlayTop: 'rgba(20,184,166,0.22)', overlayBottom: 'rgba(249,115,22,0.30)',
    overlayBlend: 'soft-light', tint: '#0f766e', tintAlpha: 0.08, tintBlend: 'multiply',
    filter: 'saturate(1.15) contrast(1.05) brightness(1.01)',
    skyTop: '#082f49', skyMid: '#0e7490', skyBottom: '#f97316',
    sun: '#fdba74', sea: '#0c2d48', accent: '#fdba74',
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[0];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Panel rectangles for a layout on a canvas of W x H, with even gutters.
export function layoutPanels(layoutId, W, H) {
  const g = Math.max(6, Math.round(Math.min(W, H) * 0.014));
  const m = g;
  const iw = W - m * 2;
  const ih = H - m * 2;
  const landscape = W > H;
  const id = layoutById(layoutId).id;

  if (id === 'split') {
    if (landscape) {
      const w = (iw - g) / 2;
      return [
        { x: m, y: m, w, h: ih },
        { x: m + w + g, y: m, w, h: ih },
      ];
    }
    const h = (ih - g) / 2;
    return [
      { x: m, y: m, w: iw, h },
      { x: m, y: m + h + g, w: iw, h },
    ];
  }

  if (id === 'quad') {
    const w = (iw - g) / 2;
    const h = (ih - g) / 2;
    return [
      { x: m, y: m, w, h },
      { x: m + w + g, y: m, w, h },
      { x: m, y: m + h + g, w, h },
      { x: m + w + g, y: m + h + g, w, h },
    ];
  }

  // triptych: one hero panel plus two smaller ones
  if (landscape) {
    const heroW = iw * 0.58;
    const sideW = iw - heroW - g;
    const sideH = (ih - g) / 2;
    return [
      { x: m, y: m, w: heroW, h: ih },
      { x: m + heroW + g, y: m, w: sideW, h: sideH },
      { x: m + heroW + g, y: m + sideH + g, w: sideW, h: sideH },
    ];
  }
  const heroH = ih * 0.58;
  const rowH = ih - heroH - g;
  const rowW = (iw - g) / 2;
  return [
    { x: m, y: m, w: iw, h: heroH },
    { x: m, y: m + heroH + g, w: rowW, h: rowH },
    { x: m + rowW + g, y: m + heroH + g, w: rowW, h: rowH },
  ];
}

// Index of the panel containing point (x, y), or -1.
export function panelAt(panels, x, y) {
  for (let i = 0; i < panels.length; i += 1) {
    const p = panels[i];
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
  }
  return -1;
}

// Where a photo lands inside its panel: cover-fit, scaled by slot.zoom and
// panned by slot.panX / slot.panY, each a fraction (-1..1) of the overflow.
// Fractions keep a crop identical at preview size and at export size.
export function photoDrawRect(image, rect, slot) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (slot.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const maxPanX = Math.max(0, (dw - rect.w) / 2);
  const maxPanY = Math.max(0, (dh - rect.h) / 2);
  const px = clamp(slot.panX || 0, -1, 1) * maxPanX;
  const py = clamp(slot.panY || 0, -1, 1) * maxPanY;
  return {
    x: rect.x + (rect.w - dw) / 2 + px,
    y: rect.y + (rect.h - dh) / 2 + py,
    w: dw, h: dh, maxPanX, maxPanY,
  };
}

function drawPhotoPanel(ctx, image, rect, slot, grade) {
  const dest = photoDrawRect(image, rect, slot);
  ctx.save();
  if (grade.filter) ctx.filter = grade.filter;
  ctx.drawImage(image, dest.x, dest.y, dest.w, dest.h);
  ctx.restore();
}

// One palm tree silhouette: a curved trunk and drooping fronds.
function drawPalmSilhouette(ctx, baseX, baseY, height, lean, color) {
  const crownX = baseX + lean * height * 0.28;
  const crownY = baseY - height;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // trunk
  ctx.lineWidth = Math.max(2, height * 0.045);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(
    baseX + lean * height * 0.05, baseY - height * 0.55,
    crownX, crownY,
  );
  ctx.stroke();
  // fronds: curved blades fanning from the crown
  const fronds = 7;
  for (let i = 0; i < fronds; i += 1) {
    const t = i / (fronds - 1); // 0..1 across the fan
    const angle = Math.PI * (1.05 + t * 0.9) + lean * 0.25;
    const len = height * (0.42 + 0.2 * Math.sin(t * Math.PI));
    const tipX = crownX + Math.cos(angle) * len;
    const tipY = crownY + Math.sin(angle) * len * 0.45 + len * 0.42;
    const midX = crownX + Math.cos(angle) * len * 0.5;
    const midY = crownY + Math.sin(angle) * len * 0.5 - len * 0.12;
    const backX = crownX + Math.cos(angle + 0.28) * len * 0.45;
    const backY = crownY + Math.sin(angle + 0.28) * len * 0.45 + len * 0.1;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(backX, backY, crownX, crownY);
    ctx.closePath();
    ctx.fill();
  }
  // coconuts
  ctx.beginPath();
  ctx.arc(crownX - height * 0.03, crownY + height * 0.03, height * 0.03, 0, Math.PI * 2);
  ctx.arc(crownX + height * 0.035, crownY + height * 0.02, height * 0.026, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBirds(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = 'round';
  const spots = [[0, 0], [1.6, -0.5], [3.1, 0.3]];
  for (const [dx, dy] of spots) {
    const bx = x + dx * size;
    const by = y + dy * size;
    ctx.beginPath();
    ctx.moveTo(bx - size * 0.45, by);
    ctx.quadraticCurveTo(bx - size * 0.2, by - size * 0.35, bx, by);
    ctx.quadraticCurveTo(bx + size * 0.2, by - size * 0.35, bx + size * 0.45, by);
    ctx.stroke();
  }
  ctx.restore();
}

// A synthwave sunset drawn in code: gradient sky, a slatted sun, a sea band
// with a light streak, palm silhouettes and birds. Fills any panel that has
// no photo yet, so the cover always looks finished.
export function drawSunsetBackdrop(ctx, rect, grade, seed) {
  const { x, y, w, h } = rect;
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, grade.skyMid);
  sky.addColorStop(1, grade.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // slatted sun, its position varied per panel so neighbours differ
  const sunX = x + w * (0.32 + (seed % 3) * 0.18);
  const sunY = y + h * 0.44;
  const sunR = Math.min(w, h) * 0.26;
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // slits across the sun's lower half, filled with the sky gradient itself
  ctx.fillStyle = sky;
  let slitY = sunY + sunR * 0.05;
  let slitH = Math.max(2, sunR * 0.07);
  while (slitY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, slitY, sunR * 2, slitH);
    slitY += slitH + sunR * 0.16;
    slitH *= 1.5;
  }

  // sea band with a reflection streak under the sun
  const seaY = y + h * 0.7;
  const sea = ctx.createLinearGradient(x, seaY, x, y + h);
  sea.addColorStop(0, grade.sea);
  sea.addColorStop(1, '#0a0618');
  ctx.fillStyle = sea;
  ctx.fillRect(x, seaY, w, y + h - seaY);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = grade.sun;
  const streakW = sunR * 0.9;
  for (let i = 0; i < 6; i += 1) {
    const ry = seaY + (y + h - seaY) * (0.08 + i * 0.15);
    const rw = streakW * (1 - i * 0.09);
    ctx.fillRect(sunX - rw / 2, ry, rw, Math.max(2, h * 0.008));
  }
  ctx.restore();

  // palms left and right, cropped by the panel edge
  const silhouette = '#160a24';
  drawPalmSilhouette(ctx, x + w * 0.06, y + h * 1.02, h * 0.52, 0.5, silhouette);
  drawPalmSilhouette(ctx, x + w * 0.96, y + h * 1.02, h * 0.44, -0.6, silhouette);
  drawBirds(ctx, x + w * 0.58, y + h * 0.16, Math.min(w, h) * 0.045, 'rgba(22,10,36,0.8)');
}

// The colour grade over one finished panel: gradient wash, tint, vignette.
function applyPhotoGrade(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.globalCompositeOperation = grade.overlayBlend;
  const wash = ctx.createLinearGradient(x, y, x, y + h);
  wash.addColorStop(0, grade.overlayTop);
  wash.addColorStop(1, grade.overlayBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = grade.tintBlend;
  ctx.globalAlpha = grade.tintAlpha;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // vignette
  ctx.save();
  const vig = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.35,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(8,2,16,0)');
  vig.addColorStop(1, 'rgba(8,2,16,0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawSparkle(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fitTitleSize(ctx, text, maxWidth, startSize) {
  let size = startSize;
  const font = (s) => `${s}px Anton, 'Arial Narrow', sans-serif`;
  ctx.font = font(size);
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size = Math.round(size * 0.94);
    ctx.font = font(size);
  }
  return size;
}

// Bold caption lettering: auto-fitted Anton title with outline/shadow,
// a letterspaced subtitle above it with a flanking rule, and a sparkle.
function drawCaptionLettering(ctx, W, H, state, grade) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (!title && !subtitle) return;

  const margin = Math.max(10, Math.min(W, H) * 0.045);
  const landscape = W > H;
  const maxTitleWidth = W * (landscape ? 0.68 : 0.88);
  const baseSize = Math.min(W, H) * 0.115 * (state.titleScale || 1);
  const titleSize = title ? fitTitleSize(ctx, title, maxTitleWidth, baseSize) : 0;

  ctx.save();
  ctx.translate(margin, H - margin);
  ctx.rotate(-0.018);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (title) {
    ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
    const style = state.titleStyle || 'outline';
    const color = state.titleColor || '#ffffff';
    if (style === 'outline') {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, titleSize * 0.14);
      ctx.strokeStyle = '#14081f';
      ctx.strokeText(title, 0, 0);
      ctx.fillStyle = color;
      ctx.fillText(title, 0, 0);
    } else if (style === 'shadow') {
      ctx.shadowColor = 'rgba(10,0,20,0.65)';
      ctx.shadowBlur = titleSize * 0.1;
      ctx.shadowOffsetY = titleSize * 0.05;
      ctx.fillStyle = color;
      ctx.fillText(title, 0, 0);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.fillStyle = color;
      ctx.fillText(title, 0, 0);
    }
    // accent underline under the title
    const titleWidth = ctx.measureText(title).width;
    ctx.fillStyle = grade.accent;
    ctx.fillRect(0, titleSize * 0.14, Math.min(titleWidth, maxTitleWidth), Math.max(2, titleSize * 0.045));
    drawSparkle(ctx, Math.min(titleWidth, maxTitleWidth) + titleSize * 0.28, -titleSize * 0.62, titleSize * 0.16, grade.accent);
  }

  if (subtitle) {
    const subSize = Math.max(14, (titleSize || baseSize) * 0.24);
    ctx.font = `700 ${subSize}px 'Arial Narrow', Arial, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`;
    const subY = -(titleSize ? titleSize * 1.02 : 0) - subSize * 0.4;
    ctx.shadowColor = 'rgba(10,0,20,0.7)';
    ctx.shadowBlur = Math.max(3, subSize * 0.25);
    ctx.shadowOffsetY = Math.max(1, subSize * 0.08);
    ctx.fillStyle = grade.accent;
    ctx.fillText(subtitle, 0, subY);
    // measure while the letter-spacing is still set, so the rule that
    // follows starts after the spaced text instead of crossing it
    const subWidth = ctx.measureText(subtitle).width;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    // flanking rule after the subtitle
    const ruleY = subY - subSize * 0.32;
    const ruleH = Math.max(1.5, subSize * 0.09);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(subWidth + subSize * 0.5, ruleY, Math.min(W * 0.14, 220), ruleH);
  }
  ctx.restore();
}

// Draw the whole cover into ctx at W x H from the editor state:
// { layout, grade, title, subtitle, titleScale, titleColor, titleStyle,
//   photos: [{ id, image }], panels: [{ photoId, zoom, panX, panY }] }
export function renderCover(ctx, W, H, state) {
  const grade = gradeById(state.grade);
  const panels = layoutPanels(state.layout, W, H);
  const slots = state.panels || [];
  const photosById = new Map((state.photos || []).map((p) => [p.id, p.image]));

  ctx.save();
  ctx.fillStyle = GUTTER_COLOR;
  ctx.fillRect(0, 0, W, H);

  panels.forEach((rect, i) => {
    const slot = slots[i] || { photoId: null, zoom: 1, panX: 0, panY: 0 };
    const image = slot.photoId ? photosById.get(slot.photoId) : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (image) {
      drawPhotoPanel(ctx, image, rect, slot, grade);
    } else {
      drawSunsetBackdrop(ctx, rect, grade, i);
    }
    applyPhotoGrade(ctx, rect, grade);
    ctx.restore();
    // crisp poster edge around each panel
    ctx.save();
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });

  // soft scrim across the bottom band so the lettering always reads
  const scrimTop = H * 0.66;
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
  scrim.addColorStop(0, 'rgba(10,4,20,0)');
  scrim.addColorStop(1, 'rgba(10,4,20,0.42)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  drawCaptionLettering(ctx, W, H, state, grade);
  ctx.restore();
}
