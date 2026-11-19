// shots.js — reproducible screenshot setups for the entry.
//
// ?shot=editor&photo=boulevard&caption=Boulevard%20Queen&layout=quad&grade=neon
// loads a sample, sets the caption and opens the editor ready to shoot.
// ?shot=cover renders the cover full-bleed (editor chrome hidden) — the app's
// own drawing of the cover at a size within the screenshot limits.
// No effect without a ?shot= parameter: normal visitors never see it.

const SHOT_PHOTOS = {
  pier: 'sample-pier',
  boulevard: 'sample-boulevard',
};

export async function applyShotParams(api) {
  const query = new URLSearchParams(window.location.search);
  const shot = query.get('shot');
  if (!shot) return false;

  const layout = query.get('layout');
  if (layout) api.setLayout(layout);
  const grade = query.get('grade');
  if (grade) api.setGrade(grade);
  const size = query.get('size');
  if (size) api.setSize(size);

  const photo = query.get('photo');
  if (photo && SHOT_PHOTOS[photo]) {
    const record = await api.addSamplePhoto(SHOT_PHOTOS[photo]);
    if (record) {
      const fill = query.get('fill');
      if (fill === 'one') {
        api.assignPhotoToSelectedPanel(record.id);
      } else {
        api.fillAllPanels(record.id);
      }
    }
  }

  const caption = query.get('caption');
  const subtitle = query.get('subtitle');
  if (caption !== null || subtitle !== null) {
    api.setCaption(caption, subtitle);
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // full-bleed cover: preview fills the viewport, chrome hidden
    api.renderPreview();
  }
  return true;
}
