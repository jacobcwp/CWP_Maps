(function() {
  const viewport = document.getElementById('viewport');
  const container = document.getElementById('map-container');
  const img = document.getElementById('map-img');
  const zoomLabel = document.getElementById('zoom-label');
  const zoomReadout = document.getElementById('zoom-readout');
  const coordReadout = document.getElementById('coord-readout');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnReset = document.getElementById('btn-reset');

  if (!viewport || !container || !img || !zoomLabel || !btnZoomIn || !btnZoomOut || !btnReset) {
    return;
  }

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let lastTouchX = null;
  let lastTouchY = null;
  let lastDist = null;

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 8;
  const ZOOM_FACTOR = 1.15;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function updateReadouts() {
    const pct = Math.round(scale * 100);
    zoomLabel.textContent = `${pct}%`;
    if (zoomReadout) {
      zoomReadout.textContent = `ZOOM: ${pct}%`;
    }
  }

  function applyTransform() {
    container.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    updateReadouts();
  }

  function fitToView() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const iw = img.naturalWidth || img.width || 1000;
    const ih = img.naturalHeight || img.height || 1000;
    const sx = (vw * 0.9) / iw;
    const sy = (vh * 0.9) / ih;
    scale = Math.min(sx, sy, 1);
    panX = (vw - iw * scale) / 2;
    panY = (vh - ih * scale) / 2;
    applyTransform();
  }

  function zoomAt(mx, my, factor) {
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = newScale / scale;
    panX = mx - ratio * (mx - panX);
    panY = my - ratio * (my - panY);
    scale = newScale;
    applyTransform();
  }

  function updateMouseCoords(clientX, clientY) {
    if (!coordReadout) return;
    const rect = viewport.getBoundingClientRect();
    const mx = (clientX - rect.left - panX) / scale;
    const my = (clientY - rect.top - panY) / scale;
    coordReadout.textContent = `X: ${Math.round(mx)} · Y: ${Math.round(my)}`;
  }

  img.onload = () => fitToView();
  if (img.complete) fitToView();

  viewport.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
    viewport.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) {
      updateMouseCoords(e.clientX, e.clientY);
      return;
    }
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    viewport.style.cursor = 'grab';
  });

  viewport.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      lastDist = null;
    } else if (e.touches.length === 2) {
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
    e.preventDefault();
  }, { passive: false });

  viewport.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && lastDist === null) {
      panX += e.touches[0].clientX - lastTouchX;
      panY += e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist) {
        const ratio = dist / lastDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = viewport.getBoundingClientRect();
        zoomAt(cx - rect.left, cy - rect.top, ratio);
      }
      lastDist = dist;
    }
    e.preventDefault();
  }, { passive: false });

  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    zoomAt(mouseX, mouseY, factor);
  }, { passive: false });

  btnZoomIn.addEventListener('click', () => {
    zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, ZOOM_FACTOR * 1.5);
  });

  btnZoomOut.addEventListener('click', () => {
    zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / (ZOOM_FACTOR * 1.5));
  });

  btnReset.addEventListener('click', fitToView);
})();
