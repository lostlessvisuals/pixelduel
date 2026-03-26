const tauri = window.__TAURI__;

const state = {
  infoA: null,
  infoB: null,
  exportId: null,
  exportOutput: null,
  isExporting: false,
};

const elements = {
  app: document.querySelector('.app'),
  inputPanelA: document.querySelector('#input-a'),
  inputPanelB: document.querySelector('#input-b'),
  badgeA: document.querySelector('[data-field="badge-a"]'),
  badgeB: document.querySelector('[data-field="badge-b"]'),
  summaryA: document.querySelector('[data-field="summary-a"]'),
  summaryB: document.querySelector('[data-field="summary-b"]'),
  metaA: document.querySelector('[data-field="meta-a"]'),
  metaB: document.querySelector('[data-field="meta-b"]'),
  stageLoad: document.querySelector('[data-field="stage-load"]'),
  stageCompare: document.querySelector('[data-field="stage-compare"]'),
  stageExport: document.querySelector('[data-field="stage-export"]'),
  pathA: document.querySelector('[data-field="path-a"]'),
  pathB: document.querySelector('[data-field="path-b"]'),
  compareGrid: document.querySelector('#compare-grid'),
  compareSummary: document.querySelector('[data-field="compare-summary"]'),
  previewA: document.querySelector('[data-field="preview-a"]'),
  previewB: document.querySelector('[data-field="preview-b"]'),
  previewFrameA: document.querySelector('[data-field="preview-frame-a"]'),
  previewFrameB: document.querySelector('[data-field="preview-frame-b"]'),
  filenameA: document.querySelector('[data-field="filename-a"]'),
  filenameB: document.querySelector('[data-field="filename-b"]'),
  outputPath: document.querySelector('[data-field="output-path"]'),
  exportMode: document.querySelector('[data-field="export-mode"]'),
  stackDirection: document.querySelector('[data-field="stack-direction"]'),
  exportSummary: document.querySelector('[data-field="export-summary"]'),
  container: document.querySelector('[data-field="container"]'),
  codec: document.querySelector('[data-field="codec"]'),
  crf: document.querySelector('[data-field="crf"]'),
  resizeWidth: document.querySelector('[data-field="resize-width"]'),
  resizeHeight: document.querySelector('[data-field="resize-height"]'),
  keepAspect: document.querySelector('[data-field="keep-aspect"]'),
  fps: document.querySelector('[data-field="fps"]'),
  trimStartFrame: document.querySelector('[data-field="trim-start-frame"]'),
  trimEndFrame: document.querySelector('[data-field="trim-end-frame"]'),
  labelA: document.querySelector('[data-field="label-a"]'),
  labelB: document.querySelector('[data-field="label-b"]'),
  audioCopy: document.querySelector('[data-field="audio-copy"]'),
  progressShell: document.querySelector('[data-field="progress-shell"]'),
  progress: document.querySelector('progress'),
  progressText: document.querySelector('[data-field="progress-text"]'),
  status: document.querySelector('[data-field="status"]'),
  playButton: document.querySelector('[data-action="play-both"]'),
  pauseButton: document.querySelector('[data-action="pause-both"]'),
  resetButton: document.querySelector('[data-action="reset-both"]'),
  exportButton: document.querySelector('[data-action="export"]'),
  cancelButton: document.querySelector('[data-action="cancel"]'),
  openOutputButton: document.querySelector('[data-action="open-output"]'),
};

function setStatus(message, tone = 'error') {
  elements.status.textContent = message || '';
  elements.status.dataset.tone = tone;
}

function setProgressState(mode) {
  elements.progressShell.dataset.state = mode;
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function toVideoSrc(path) {
  if (!path) return '';
  if (tauri?.core?.convertFileSrc) {
    return tauri.core.convertFileSrc(path);
  }
  return `file://${path.replace(/\\/g, '/')}`;
}

function fileNameFromPath(path) {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function setPreviewSourceState(target, hasSource) {
  const frame = target === 'a' ? elements.previewFrameA : elements.previewFrameB;
  if (frame) {
    frame.dataset.hasSource = hasSource ? 'true' : 'false';
  }
}

function updateFileNames() {
  const nameA = fileNameFromPath(elements.pathA.value);
  const nameB = fileNameFromPath(elements.pathB.value);

  let displayA = nameA || 'Input A';
  let displayB = nameB || 'Input B';
  if (nameA && nameB && nameA === nameB) {
    displayA = `${nameA} (1)`;
    displayB = `${nameB} (2)`;
  }

  elements.filenameA.textContent = displayA;
  elements.filenameB.textContent = displayB;
  elements.filenameA.title = displayA;
  elements.filenameB.title = displayB;
}

function mediaElements() {
  return [elements.previewA, elements.previewB].filter((video) => video?.src);
}

function syncTransportControls() {
  const hasMedia = mediaElements().length > 0;
  elements.playButton.disabled = !hasMedia;
  elements.pauseButton.disabled = !hasMedia;
  elements.resetButton.disabled = !hasMedia;
}

async function playBoth() {
  const videos = mediaElements();
  if (videos.length === 0) {
    setStatus('Load previews first.', 'warn');
    return;
  }
  const targetTime = Math.min(...videos.map((video) => video.currentTime || 0));
  for (const video of videos) {
    video.currentTime = targetTime;
  }
  await Promise.all(videos.map((video) => video.play().catch(() => null)));
}

function pauseBoth() {
  for (const video of mediaElements()) {
    video.pause();
  }
}

function resetBoth() {
  for (const video of mediaElements()) {
    video.pause();
    video.currentTime = 0;
  }
}

function formatMaybe(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

function formatBitrate(value) {
  if (!value) return '-';
  const kbps = Number(value) / 1000;
  if (Number.isNaN(kbps)) return value;
  return `${kbps.toFixed(0)} kbps`;
}

function formatDuration(value) {
  if (!value && value !== 0) return '-';
  const seconds = Number(value);
  if (Number.isNaN(seconds)) return value;
  return `${seconds.toFixed(2)} s`;
}

function formatResolution(video) {
  if (!video?.width || !video?.height) return '-';
  return `${video.width}x${video.height}`;
}

function formatBytes(value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (num < 1024) return `${num} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = num;
  let unitIndex = -1;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatMode(mode) {
  if (mode === 'input-a') return 'Input A only';
  if (mode === 'input-b') return 'Input B only';
  return 'Side by side';
}

function formatStackDirection(direction) {
  return direction === 'vertical' ? 'Vertical stack' : 'Horizontal stack';
}

function renderChips(container, chips) {
  container.innerHTML = chips
    .map((chip) => `<span class="meta-chip${chip.muted ? ' muted' : ''}">${escapeHtml(chip.label)}</span>`)
    .join('');
}

function setSummary(element, text, chips = []) {
  const chipMarkup = chips
    .map((chip) => `<span class="summary-pill ${escapeHtml(chip.tone || 'idle')}">${escapeHtml(chip.label)}</span>`)
    .join('');
  element.innerHTML = `${escapeHtml(text)}${chipMarkup ? `<div class="meta-chips">${chipMarkup}</div>` : ''}`;
}

function inputInfo(target) {
  return target === 'a' ? state.infoA : state.infoB;
}

function inputElements(target) {
  return target === 'a'
    ? { panel: elements.inputPanelA, badge: elements.badgeA, summary: elements.summaryA, meta: elements.metaA, path: elements.pathA }
    : { panel: elements.inputPanelB, badge: elements.badgeB, summary: elements.summaryB, meta: elements.metaB, path: elements.pathB };
}

function renderInputState(target) {
  const info = inputInfo(target);
  const { panel, badge, summary, meta, path } = inputElements(target);
  const value = path.value.trim();

  if (!value) {
    panel.dataset.state = 'idle';
    badge.dataset.tone = 'idle';
    badge.textContent = 'Empty';
    summary.textContent =
      target === 'a' ? 'Drop a video here to start building your comparison.' : 'Load the second clip when you are ready to compare output.';
    renderChips(meta, [{ label: 'Waiting for video', muted: true }]);
    setPreviewSourceState(target, false);
    return;
  }

  if (!info) {
    panel.dataset.state = 'loading';
    badge.dataset.tone = 'loading';
    badge.textContent = 'Loading';
    summary.textContent = `${fileNameFromPath(value)} is selected. Reading metadata now.`;
    renderChips(meta, [{ label: 'Reading metadata...' }, { label: 'Preview ready', muted: true }]);
    setPreviewSourceState(target, true);
    return;
  }

  panel.dataset.state = 'ready';
  badge.dataset.tone = 'ready';
  badge.textContent = 'Ready';
  summary.textContent = `${fileNameFromPath(value)} is ready for preview, compare, and export defaults.`;

  const chips = [
    { label: formatResolution(info.video) },
    { label: formatDuration(info.container?.duration_sec) },
    { label: formatMaybe(info.video?.codec_name, 'No video codec') },
  ];
  if (info.video?.fps) chips.push({ label: `${info.video.fps.toFixed(3)} fps` });
  if (info.audio?.codec_name) chips.push({ label: `Audio ${info.audio.codec_name}` });
  chips.push({ label: formatBytes(info.size_bytes) });
  renderChips(meta, chips);
  setPreviewSourceState(target, true);
}

function setPreviewAspect(target, info) {
  const frame = target === 'a' ? elements.previewFrameA : elements.previewFrameB;
  if (frame) {
    frame.dataset.hasInfo = info ? 'true' : 'false';
  }
}

function collectComparisonRows() {
  const infoA = state.infoA;
  const infoB = state.infoB;
  return [
    ['File', fileNameFromPath(infoA?.file), fileNameFromPath(infoB?.file)],
    ['Size', formatBytes(infoA?.size_bytes), formatBytes(infoB?.size_bytes)],
    ['Container', formatMaybe(infoA?.container?.format_name), formatMaybe(infoB?.container?.format_name)],
    ['Duration', formatDuration(infoA?.container?.duration_sec), formatDuration(infoB?.container?.duration_sec)],
    ['Bitrate', formatBitrate(infoA?.container?.bitrate), formatBitrate(infoB?.container?.bitrate)],
    ['Video Codec', formatMaybe(infoA?.video?.codec_name), formatMaybe(infoB?.video?.codec_name)],
    ['Profile', formatMaybe(infoA?.video?.profile), formatMaybe(infoB?.video?.profile)],
    ['Resolution', formatResolution(infoA?.video), formatResolution(infoB?.video)],
    ['Pixel Format', formatMaybe(infoA?.video?.pix_fmt), formatMaybe(infoB?.video?.pix_fmt)],
    ['Color Space', formatMaybe(infoA?.video?.color_space), formatMaybe(infoB?.video?.color_space)],
    ['Frame Rate', infoA?.video?.fps ? `${infoA.video.fps.toFixed(3)} fps` : '-', infoB?.video?.fps ? `${infoB.video.fps.toFixed(3)} fps` : '-'],
    ['Frame Count', formatMaybe(infoA?.video?.frame_count), formatMaybe(infoB?.video?.frame_count)],
    ['Audio Codec', formatMaybe(infoA?.audio?.codec_name), formatMaybe(infoB?.audio?.codec_name)],
    ['Channels', formatMaybe(infoA?.audio?.channels), formatMaybe(infoB?.audio?.channels)],
    ['Sample Rate', infoA?.audio?.sample_rate ? `${infoA.audio.sample_rate} Hz` : '-', infoB?.audio?.sample_rate ? `${infoB.audio.sample_rate} Hz` : '-'],
    ['Audio Bitrate', formatBitrate(infoA?.audio?.bit_rate), formatBitrate(infoB?.audio?.bit_rate)],
  ];
}

function renderCompare() {
  if (!state.infoA && !state.infoB) {
    setSummary(elements.compareSummary, 'Load both inputs to unlock a confident side-by-side review.', [{ label: 'Waiting for files', tone: 'idle' }]);
    elements.compareGrid.innerHTML = '<div class="placeholder">Load Input A and B to compare.</div>';
    return;
  }

  const rows = collectComparisonRows();

  if (!state.infoA || !state.infoB) {
    const readySide = state.infoA ? 'Input A is ready.' : 'Input B is ready.';
    const missingSide = state.infoA ? 'Add Input B to complete the comparison.' : 'Add Input A to complete the comparison.';
    setSummary(elements.compareSummary, `${readySide} ${missingSide}`, [{ label: 'One clip missing', tone: 'warn' }]);
  } else {
    const comparableRows = rows.filter(([, a, b]) => a !== '-' && b !== '-');
    const diffCount = comparableRows.filter(([, a, b]) => String(a ?? '') !== String(b ?? '')).length;
    const sameCount = comparableRows.length - diffCount;
    setSummary(elements.compareSummary, 'Both clips are loaded. Playback and metadata are ready for a clean side-by-side check.', [
      { label: `${diffCount} differences`, tone: diffCount > 0 ? 'warn' : 'ready' },
      { label: `${sameCount} matches`, tone: 'ready' },
    ]);
  }

  elements.compareGrid.innerHTML = `
    <table>
      <colgroup>
        <col style="width: 220px" />
        <col />
        <col />
      </colgroup>
      <tbody>
        <tr>
          <td>Field</td>
          <td>Input A</td>
          <td>Input B</td>
        </tr>
        ${rows
          .map(([label, a, b]) => {
            const same = String(a ?? '') === String(b ?? '');
            return `
              <tr>
                <td>${escapeHtml(label)}</td>
                <td class="${same ? 'same' : 'diff'}">${escapeHtml(a ?? '-')}</td>
                <td class="${same ? 'same' : 'diff'}">${escapeHtml(b ?? '-')}</td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function getTargetPath(target) {
  return target === 'a' ? elements.pathA.value.trim() : elements.pathB.value.trim();
}

function clearTarget(target) {
  const video = target === 'a' ? elements.previewA : elements.previewB;
  if (target === 'a') state.infoA = null;
  if (target === 'b') state.infoB = null;
  video.pause();
  video.removeAttribute('src');
  video.dataset.sourcePath = '';
  video.load();
  setPreviewAspect(target, null);
  setPreviewSourceState(target, false);
}

async function browseFile(target) {
  if (!tauri?.dialog) {
    setStatus('Tauri dialog API not available.', 'error');
    return;
  }
  const path = await tauri.dialog.open({
    multiple: false,
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] }],
  });
  if (typeof path === 'string') {
    if (target === 'a') elements.pathA.value = path;
    if (target === 'b') elements.pathB.value = path;
    loadPreviewForTarget(target);
  }
}

function suggestOutputPath(inputPath) {
  if (!inputPath) return '';
  const ext = elements.container.value || 'mp4';
  const base = inputPath.replace(/\.[^/.]+$/, '');
  return `${base}_export.${ext}`;
}

function applyExportDefaultsFromInfo(info, target) {
  if (!info) return;
  const mode = elements.exportMode.value;
  if (mode === 'input-a' && target !== 'a') return;
  if (mode === 'input-b' && target !== 'b') return;

  if (!elements.outputPath.value.trim()) {
    elements.outputPath.value = suggestOutputPath(info.file);
  }

  if (info.video?.width) elements.resizeWidth.value = info.video.width;
  if (info.video?.height) elements.resizeHeight.value = info.video.height;
  if (info.video?.fps) elements.fps.value = info.video.fps.toFixed(3);
  if (elements.trimStartFrame.value.trim() === '') elements.trimStartFrame.value = '0';
  if (elements.trimEndFrame.value.trim() === '' && info.video?.frame_count) {
    elements.trimEndFrame.value = String(info.video.frame_count);
  }
}

function getActiveAspectRatio() {
  const mode = elements.exportMode.value;
  if (mode === 'input-a' && state.infoA?.video?.width && state.infoA?.video?.height) {
    return state.infoA.video.width / state.infoA.video.height;
  }
  if (mode === 'input-b' && state.infoB?.video?.width && state.infoB?.video?.height) {
    return state.infoB.video.width / state.infoB.video.height;
  }
  return null;
}

function updateLinkedResize(changed) {
  if (!elements.keepAspect.checked) return;
  const ratio = getActiveAspectRatio();
  if (!ratio) return;

  if (changed === 'width') {
    const width = numberValue(elements.resizeWidth);
    if (width) elements.resizeHeight.value = Math.max(1, Math.round(width / ratio));
  } else if (changed === 'height') {
    const height = numberValue(elements.resizeHeight);
    if (height) elements.resizeWidth.value = Math.max(1, Math.round(height * ratio));
  }
}

function updateExportModeUI() {
  const isSideBySide = elements.exportMode.value === 'side-by-side';
  const controls = [elements.resizeWidth, elements.resizeHeight, elements.keepAspect, elements.fps, elements.trimStartFrame, elements.trimEndFrame];
  for (const control of controls) {
    if (!control) continue;
    control.disabled = isSideBySide;
  }
  if (elements.stackDirection) {
    elements.stackDirection.disabled = !isSideBySide;
  }
  elements.labelA.disabled = !isSideBySide;
  elements.labelB.disabled = !isSideBySide;
  if (isSideBySide) {
    elements.resizeWidth.value = '';
    elements.resizeHeight.value = '';
    elements.fps.value = '';
    elements.trimStartFrame.value = '';
    elements.trimEndFrame.value = '';
  } else {
    const activeInfo = elements.exportMode.value === 'input-a' ? state.infoA : state.infoB;
    const activeTarget = elements.exportMode.value === 'input-a' ? 'a' : 'b';
    if (activeInfo) {
      applyExportDefaultsFromInfo(activeInfo, activeTarget);
    }
  }
}

function computeStageState() {
  const loadReady = Boolean(state.infoA || state.infoB);
  const compareReady = Boolean(state.infoA && state.infoB);

  let exportReady = false;
  const mode = elements.exportMode.value;
  if (mode === 'input-a') exportReady = Boolean(state.infoA && elements.outputPath.value.trim());
  if (mode === 'input-b') exportReady = Boolean(state.infoB && elements.outputPath.value.trim());
  if (mode === 'side-by-side') exportReady = Boolean(state.infoA && state.infoB && elements.outputPath.value.trim());

  elements.stageLoad.dataset.state = loadReady ? (state.infoA && state.infoB ? 'ready' : 'active') : 'idle';
  elements.stageCompare.dataset.state = compareReady ? 'ready' : loadReady ? 'active' : 'idle';
  elements.stageExport.dataset.state = exportReady ? 'ready' : compareReady || loadReady ? 'active' : 'idle';
}

function evenize(value) {
  if (!value) return value;
  return value % 2 === 0 ? value : value - 1;
}

function computeStackHeight() {
  const heightA = state.infoA?.video?.height ?? null;
  const heightB = state.infoB?.video?.height ?? null;
  if (!heightA || !heightB) return null;
  return evenize(Math.min(heightA, heightB));
}

function computeStackWidth() {
  const widthA = state.infoA?.video?.width ?? null;
  const widthB = state.infoB?.video?.width ?? null;
  if (!widthA || !widthB) return null;
  return evenize(Math.min(widthA, widthB));
}

function renderExportSummary() {
  const mode = elements.exportMode.value;
  const outputPath = elements.outputPath.value.trim();
  const activeInfo = mode === 'input-a' ? state.infoA : mode === 'input-b' ? state.infoB : state.infoA && state.infoB ? { file: 'both' } : null;

  if (!activeInfo) {
    const missing = mode === 'side-by-side' ? 'Load both inputs before side-by-side export.' : `Load ${mode === 'input-a' ? 'Input A' : 'Input B'} to seed your export defaults.`;
    setSummary(elements.exportSummary, missing, [{ label: formatMode(mode), tone: 'idle' }]);
    return;
  }

  const chips = [
    { label: formatMode(mode), tone: 'info' },
    { label: elements.container.value.toUpperCase(), tone: 'ready' },
    { label: elements.codec.value.toUpperCase(), tone: 'ready' },
    { label: `CRF ${elements.crf.value}`, tone: 'ready' },
  ];

  if (mode === 'side-by-side') {
    const stackDirection = elements.stackDirection.value;
    chips.push({ label: formatStackDirection(stackDirection), tone: 'info' });
    const stackSize = stackDirection === 'vertical' ? computeStackWidth() : computeStackHeight();
    if (stackSize) {
      const axisLabel = stackDirection === 'vertical' ? 'width' : 'height';
      chips.push({ label: `Matched ${axisLabel} ${stackSize}px`, tone: 'info' });
    }
  } else if (outputPath) {
    chips.push({ label: fileNameFromPath(outputPath), tone: 'info' });
  }

  const summaryText = outputPath
    ? `Ready to render to ${fileNameFromPath(outputPath)}.`
    : 'Choose an output path when you are ready to render.';

  setSummary(elements.exportSummary, summaryText, chips);
}

function refreshUi() {
  updateFileNames();
  renderInputState('a');
  renderInputState('b');
  renderCompare();
  renderExportSummary();
  syncTransportControls();
  computeStageState();
}

async function probe(target) {
  const path = getTargetPath(target);
  if (!path) {
    setStatus('Please select a video file first.', 'warn');
    return;
  }
  if (!tauri?.core) {
    setStatus('Tauri invoke API not available.', 'error');
    return;
  }

  try {
    const info = await tauri.core.invoke('probe_video', { path });
    if (target === 'a') {
      state.infoA = info;
    } else {
      state.infoB = info;
    }
    setPreviewAspect(target, info);
    applyExportDefaultsFromInfo(info, target);
    refreshUi();
    setStatus(`${fileNameFromPath(path)} is ready.`, 'success');
  } catch (error) {
    if (target === 'a') state.infoA = null;
    if (target === 'b') state.infoB = null;
    setPreviewAspect(target, null);
    refreshUi();
    setStatus(String(error), 'error');
  }
}

function loadPreviewForTarget(target) {
  const path = getTargetPath(target);
  const video = target === 'a' ? elements.previewA : elements.previewB;

  if (!path) {
    clearTarget(target);
    refreshUi();
    return;
  }

  if (target === 'a') state.infoA = null;
  if (target === 'b') state.infoB = null;
  video.src = toVideoSrc(path);
  video.dataset.sourcePath = path;
  setPreviewSourceState(target, true);
  refreshUi();
  video.load();
  probe(target);
}

function updateOutputPathExtension() {
  const ext = elements.container.value;
  const current = elements.outputPath.value.trim();
  if (!current) {
    renderExportSummary();
    return;
  }
  const withoutExt = current.replace(/\.[^/.]+$/, '');
  elements.outputPath.value = `${withoutExt}.${ext}`;
  renderExportSummary();
}

async function browseOutput() {
  if (!tauri?.dialog) {
    setStatus('Tauri dialog API not available.', 'error');
    return;
  }
  const path = await tauri.dialog.save({
    defaultPath: `output.${elements.container.value}`,
  });
  if (typeof path === 'string') {
    elements.outputPath.value = path;
    renderExportSummary();
    computeStageState();
  }
}

function numberValue(input) {
  const value = input.value.trim();
  if (!value) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function validateExport(inputPathA, inputPathB, outputPath, mode) {
  if (mode === 'input-a' && !inputPathA) return 'Select an Input A file.';
  if (mode === 'input-b' && !inputPathB) return 'Select an Input B file.';
  if (mode === 'side-by-side' && (!inputPathA || !inputPathB)) {
    return 'Side-by-side export needs both Input A and Input B.';
  }
  if (!outputPath) return 'Choose an output file.';
  if (inputPathA === outputPath || inputPathB === outputPath) return 'Output must be different from input.';
  return null;
}

function setExportBusy(isBusy) {
  state.isExporting = isBusy;
  elements.exportButton.disabled = isBusy;
  elements.cancelButton.disabled = !isBusy;
  setProgressState(isBusy ? 'active' : elements.progress.value >= 100 ? 'done' : 'idle');
}

async function startExport() {
  if (!tauri?.core) {
    setStatus('Tauri invoke API not available.', 'error');
    return;
  }

  const inputPathA = elements.pathA.value.trim();
  const inputPathB = elements.pathB.value.trim();
  const exportMode = elements.exportMode.value;
  const outputPath = elements.outputPath.value.trim();
  const error = validateExport(inputPathA, inputPathB, outputPath, exportMode);
  if (error) {
    setStatus(error, 'warn');
    return;
  }

  const isSideBySide = exportMode === 'side-by-side';
  const stackDirection = elements.stackDirection.value;
  const stackHeight = isSideBySide && stackDirection !== 'vertical' ? computeStackHeight() : null;
  const stackWidth = isSideBySide && stackDirection === 'vertical' ? computeStackWidth() : null;
  if (isSideBySide) {
    if (!state.infoA || !state.infoB) {
      setStatus('Load both inputs before exporting side-by-side.', 'warn');
      return;
    }
    if (stackDirection === 'vertical' && !stackWidth) {
      setStatus('Unable to determine matching widths for vertical side-by-side export.', 'error');
      return;
    }
    if (stackDirection !== 'vertical' && !stackHeight) {
      setStatus('Unable to determine matching heights for horizontal side-by-side export.', 'error');
      return;
    }
  }

  const payload = {
    inputPathA,
    inputPathB,
    exportMode,
    outputPath,
    codec: elements.codec.value,
    crf: Number(elements.crf.value),
    resizeWidth: isSideBySide ? null : numberValue(elements.resizeWidth),
    resizeHeight: isSideBySide ? null : numberValue(elements.resizeHeight),
    keepAspect: elements.keepAspect.checked,
    fps: isSideBySide ? null : numberValue(elements.fps),
    trimStartFrame: isSideBySide ? null : numberValue(elements.trimStartFrame),
    trimEndFrame: isSideBySide ? null : numberValue(elements.trimEndFrame),
    labelA: isSideBySide ? elements.labelA.value.trim() : '',
    labelB: isSideBySide ? elements.labelB.value.trim() : '',
    audioCopy: elements.audioCopy.checked,
    stackDirection: isSideBySide ? stackDirection : null,
    stackHeight,
    stackWidth,
  };

  try {
    state.exportId = null;
    state.exportOutput = null;
    elements.openOutputButton.disabled = true;
    elements.progress.value = 0;
    elements.progressText.textContent = 'Starting';
    setExportBusy(true);
    setStatus('Handing the render job to ffmpeg.', 'info');
    const result = await tauri.core.invoke('export_video', { params: payload });
    state.exportId = result.export_id;
    state.exportOutput = result.output_path;
    setStatus('Export started. Progress updates will appear here.', 'info');
  } catch (err) {
    setExportBusy(false);
    setStatus(String(err), 'error');
  }
}

async function cancelExport() {
  if (!state.exportId || !tauri?.core) return;
  try {
    await tauri.core.invoke('cancel_export', { export_id: state.exportId });
    setStatus('Export cancelled.', 'warn');
    elements.progressText.textContent = 'Cancelled';
    setProgressState('idle');
  } catch (err) {
    setStatus(String(err), 'error');
  } finally {
    setExportBusy(false);
  }
}

async function openOutputFolder() {
  if (!state.exportOutput) return;
  try {
    if (tauri?.opener?.open) {
      await tauri.opener.open(state.exportOutput);
      return;
    }
    if (tauri?.core?.invoke) {
      await tauri.core.invoke('plugin:opener|reveal_item_in_dir', { paths: [state.exportOutput] });
      return;
    }
    setStatus('Open folder is unavailable in this build.', 'warn');
  } catch (err) {
    setStatus(`Failed to open output folder: ${String(err)}`, 'error');
  }
}

function setupInputListeners() {
  ['input-a', 'input-b'].forEach((id) => {
    const panel = document.getElementById(id);
    panel.addEventListener('dragover', (event) => {
      event.preventDefault();
      panel.classList.add('dragover');
    });
    panel.addEventListener('dragleave', () => panel.classList.remove('dragover'));
    panel.addEventListener('drop', (event) => {
      event.preventDefault();
      panel.classList.remove('dragover');
      const file = event.dataTransfer?.files?.[0];
      if (file?.path) {
        if (id === 'input-a') elements.pathA.value = file.path;
        if (id === 'input-b') elements.pathB.value = file.path;
        loadPreviewForTarget(id === 'input-a' ? 'a' : 'b');
      }
    });
  });

  elements.pathA.addEventListener('input', refreshUi);
  elements.pathB.addEventListener('input', refreshUi);
  elements.pathA.addEventListener('change', () => loadPreviewForTarget('a'));
  elements.pathB.addEventListener('change', () => loadPreviewForTarget('b'));
}

function setupExportListeners() {
  elements.container.addEventListener('change', updateOutputPathExtension);
  elements.exportMode.addEventListener('change', () => {
    updateExportModeUI();
    refreshUi();
  });

  [elements.codec, elements.crf, elements.outputPath, elements.labelA, elements.labelB, elements.audioCopy, elements.stackDirection]
    .filter(Boolean)
    .forEach((element) => {
      element.addEventListener('input', () => {
        renderExportSummary();
        computeStageState();
      });
      element.addEventListener('change', () => {
      renderExportSummary();
      computeStageState();
    });
  });

  elements.resizeWidth.addEventListener('input', () => {
    updateLinkedResize('width');
    renderExportSummary();
  });
  elements.resizeHeight.addEventListener('input', () => {
    updateLinkedResize('height');
    renderExportSummary();
  });
}

function setupListeners() {
  document.querySelectorAll('[data-action="browse"]').forEach((button) => {
    button.addEventListener('click', () => browseFile(button.dataset.target));
  });

  elements.playButton.addEventListener('click', playBoth);
  elements.pauseButton.addEventListener('click', pauseBoth);
  elements.resetButton.addEventListener('click', resetBoth);
  document.querySelector('[data-action="output-browse"]').addEventListener('click', browseOutput);
  elements.exportButton.addEventListener('click', startExport);
  elements.cancelButton.addEventListener('click', cancelExport);
  elements.openOutputButton.addEventListener('click', openOutputFolder);

  setupInputListeners();
  setupExportListeners();

  [elements.previewA, elements.previewB].forEach((video) => {
    if (!video) return;
    video.addEventListener('error', () => {
      const src = video.dataset.sourcePath || video.currentSrc || video.src || 'unknown';
      const detail = video.error ? ` (code ${video.error.code})` : '';
      setStatus(`Preview failed to load: ${src}${detail}`, 'error');
    });
  });

  if (tauri?.event?.listen) {
    tauri.event.listen('export-progress', (event) => {
      const { export_id, progress, out_time_ms, message } = event.payload;
      if (export_id !== state.exportId) return;

      if (progress === 'error') {
        elements.progressText.textContent = 'Failed';
        setExportBusy(false);
        const detail = message ? `: ${message}` : '.';
        setStatus(`Export failed${detail}`, 'error');
        return;
      }

      if (out_time_ms) {
        const seconds = out_time_ms / 1000000;
        elements.progressText.textContent = `Processed ${seconds.toFixed(1)}s`;
      }

      if (progress === 'end') {
        elements.progress.value = 100;
        elements.progressText.textContent = 'Done';
        setExportBusy(false);
        elements.openOutputButton.disabled = false;
        setProgressState('done');
        setStatus('Export complete.', 'success');
        return;
      }

      const nextValue = Math.min(95, elements.progress.value + 1);
      elements.progress.value = nextValue;
      setProgressState('active');
    });
  }
}

function init() {
  setProgressState('idle');
  setStatus('Pick or drop videos to start.', 'info');
  updateExportModeUI();
  refreshUi();
  setupListeners();
}

init();
