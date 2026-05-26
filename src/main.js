import { centeredPaddedBounds, clampPadding, findOpaqueBounds, normalizeCropBounds, outputName } from "./pngSnip.js";

const APP_VERSION = "0.1.6";

const state = {
  outputMode: "tight",
  result: null,
  lastFile: null,
  lastFileKey: "",
  autoCrop: null,
  manualBounds: null,
  sourceSize: null,
  processId: 0,
  manualTimer: null,
  sourcePreview: null,
  drag: null
};

const elements = {
  status: document.querySelector("#status"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  paddingInput: document.querySelector("#paddingInput"),
  tightMode: document.querySelector("#tightMode"),
  manualMode: document.querySelector("#manualMode"),
  originalMode: document.querySelector("#originalMode"),
  manualControls: document.querySelector("#manualControls"),
  cropXInput: document.querySelector("#cropXInput"),
  cropYInput: document.querySelector("#cropYInput"),
  cropWInput: document.querySelector("#cropWInput"),
  cropHInput: document.querySelector("#cropHInput"),
  resetManualButton: document.querySelector("#resetManualButton"),
  cropOverlay: document.querySelector("#cropOverlay"),
  cropBox: document.querySelector(".crop-box"),
  downloadButton: document.querySelector("#downloadButton"),
  beforeCanvas: document.querySelector("#beforeCanvas"),
  afterCanvas: document.querySelector("#afterCanvas"),
  detailsBody: document.querySelector("#detailsBody")
};

document.querySelector(".app-shell")?.setAttribute("data-version", APP_VERSION);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("sw.js", window.location.href).toString()).catch(() => {});
}

elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
});

elements.dropZone.addEventListener("dragleave", () => {
  elements.dropZone.classList.remove("dragging");
});

elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");
  processFile(event.dataTransfer.files?.[0]);
});

elements.fileInput.addEventListener("change", (event) => {
  processFile(event.target.files?.[0]);
});

elements.paddingInput.addEventListener("input", () => {
  elements.paddingInput.value = clampPadding(elements.paddingInput.value);
  if (state.lastFile) processFile(state.lastFile);
});

elements.tightMode.addEventListener("click", () => {
  setMode("tight");
});

elements.manualMode.addEventListener("click", () => {
  setMode("manual");
});

elements.originalMode.addEventListener("click", () => {
  setMode("original");
});

for (const input of [elements.cropXInput, elements.cropYInput, elements.cropWInput, elements.cropHInput]) {
  input.addEventListener("input", () => {
    updateManualBoundsFromInputs();
    scheduleManualProcess();
  });
}

elements.manualControls.addEventListener("click", (event) => {
  const button = event.target.closest("[data-nudge]");
  if (!button || !state.manualBounds || !state.sourceSize) return;
  const [dx, dy] = button.dataset.nudge.split(",").map(Number);
  state.manualBounds = normalizeCropBounds(
    { ...state.manualBounds, x: state.manualBounds.x + dx, y: state.manualBounds.y + dy },
    state.sourceSize.width,
    state.sourceSize.height
  );
  syncManualInputs(state.manualBounds);
  if (state.lastFile) processFile(state.lastFile, { preserveManual: true });
});

elements.resetManualButton.addEventListener("click", () => {
  if (!state.autoCrop || !state.sourceSize) return;
  state.manualBounds = normalizeCropBounds(state.autoCrop, state.sourceSize.width, state.sourceSize.height);
  syncManualInputs(state.manualBounds);
  if (state.lastFile) processFile(state.lastFile, { preserveManual: true });
});

elements.cropOverlay.addEventListener("pointerdown", (event) => {
  const handle = event.target.dataset.handle;
  if (!handle || !state.manualBounds || !state.sourcePreview) return;
  event.preventDefault();
  elements.cropOverlay.setPointerCapture(event.pointerId);
  state.drag = {
    handle,
    startX: event.clientX,
    startY: event.clientY,
    startBounds: { ...state.manualBounds }
  };
});

elements.cropOverlay.addEventListener("pointermove", (event) => {
  if (!state.drag || !state.sourceSize || !state.sourcePreview) return;
  const dx = Math.round((event.clientX - state.drag.startX) / state.sourcePreview.scale);
  const dy = Math.round((event.clientY - state.drag.startY) / state.sourcePreview.scale);
  state.manualBounds = resizeCropByHandle(state.drag.startBounds, state.drag.handle, dx, dy, state.sourceSize);
  syncManualInputs(state.manualBounds);
  renderCropOverlay();
  scheduleManualProcess();
});

elements.cropOverlay.addEventListener("pointerup", (event) => {
  if (state.drag) {
    elements.cropOverlay.releasePointerCapture(event.pointerId);
    state.drag = null;
  }
});

elements.downloadButton.addEventListener("click", () => {
  if (state.result) downloadBlob(state.result.blob, state.result.fileName);
});

async function processFile(file, options = {}) {
  if (!file) return;
  const runId = ++state.processId;
  if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
    updateStatus("PNG Snip only accepts PNG files.");
    state.result = null;
    elements.downloadButton.disabled = true;
    return;
  }

  const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
  const isNewFile = fileKey !== state.lastFileKey;
  state.lastFile = file;
  state.lastFileKey = fileKey;
  updateStatus("Reading PNG pixels...");

  try {
    const image = await loadImage(file);
    if (runId !== state.processId) return;
    const sourceCanvas = document.createElement("canvas");
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    sourceCtx.drawImage(image, 0, 0);

    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const bounds = findOpaqueBounds(imageData, 2);
    if (!bounds) {
      updateStatus("No visible pixels found. The PNG appears fully transparent.");
      drawPreview(elements.beforeCanvas, sourceCanvas);
      clearCanvas(elements.afterCanvas);
      state.result = null;
      elements.downloadButton.disabled = true;
      return;
    }

    const padding = clampPadding(elements.paddingInput.value);
    state.sourceSize = { width: sourceCanvas.width, height: sourceCanvas.height };
    state.autoCrop = centeredPaddedBounds(bounds, sourceCanvas.width, sourceCanvas.height, padding);
    if (isNewFile || !state.manualBounds || !options.preserveManual) {
      state.manualBounds = normalizeCropBounds(state.autoCrop, sourceCanvas.width, sourceCanvas.height);
    }
    syncManualInputs(state.manualBounds);

    const crop =
      state.outputMode === "manual"
        ? normalizeCropBounds(state.manualBounds, sourceCanvas.width, sourceCanvas.height)
        : state.autoCrop;
    const outputCanvas = document.createElement("canvas");
    const outputCtx = outputCanvas.getContext("2d");

    if (state.outputMode === "original") {
      outputCanvas.width = sourceCanvas.width;
      outputCanvas.height = sourceCanvas.height;
      const centeredX = Math.round((outputCanvas.width - crop.width) / 2);
      const centeredY = Math.round((outputCanvas.height - crop.height) / 2);
      outputCtx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, centeredX, centeredY, crop.width, crop.height);
    } else {
      outputCanvas.width = crop.width;
      outputCanvas.height = crop.height;
      outputCtx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    }

    const blob = await canvasToBlob(outputCanvas);
    if (runId !== state.processId) return;
    state.result = {
      blob,
      fileName: outputName(file.name),
      bounds,
      crop,
      source: { width: sourceCanvas.width, height: sourceCanvas.height },
      output: { width: outputCanvas.width, height: outputCanvas.height }
    };

    drawPreview(elements.beforeCanvas, sourceCanvas);
    drawPreview(elements.afterCanvas, outputCanvas);
    renderCropOverlay();
    renderDetails(state.result);
    elements.downloadButton.disabled = false;
    updateStatus(`Ready: ${state.result.fileName}`);
  } catch (error) {
    updateStatus(`Could not process PNG: ${error.message}`);
  }
}

function scheduleManualProcess() {
  window.clearTimeout(state.manualTimer);
  state.manualTimer = window.setTimeout(() => {
    if (state.lastFile) processFile(state.lastFile, { preserveManual: true });
  }, 120);
}

function setMode(mode) {
  state.outputMode = mode;
  elements.tightMode.classList.toggle("active", mode === "tight");
  elements.manualMode.classList.toggle("active", mode === "manual");
  elements.originalMode.classList.toggle("active", mode === "original");
  elements.manualControls.hidden = mode !== "manual";
  renderCropOverlay();
  if (state.lastFile) processFile(state.lastFile, { preserveManual: true });
}

function renderDetails(result) {
  const rows = [
    ["Source", `${result.source.width} x ${result.source.height}`],
    ["Graphic bounds", `${result.bounds.width} x ${result.bounds.height}`],
    ["Crop X/Y", `${result.crop.x}, ${result.crop.y}`],
    ["Crop size", `${result.crop.width} x ${result.crop.height}`],
    ["Output", `${result.output.width} x ${result.output.height}`],
    ["File", result.fileName]
  ];

  elements.detailsBody.className = "stats-grid";
  elements.detailsBody.innerHTML = rows
    .map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function updateManualBoundsFromInputs() {
  if (!state.sourceSize) return;
  state.manualBounds = normalizeCropBounds(
    {
      x: elements.cropXInput.value,
      y: elements.cropYInput.value,
      width: elements.cropWInput.value,
      height: elements.cropHInput.value
    },
    state.sourceSize.width,
    state.sourceSize.height
  );
  syncManualInputs(state.manualBounds);
}

function syncManualInputs(bounds) {
  elements.cropXInput.value = bounds.x;
  elements.cropYInput.value = bounds.y;
  elements.cropWInput.value = bounds.width;
  elements.cropHInput.value = bounds.height;
  renderCropOverlay();
}

function updateStatus(message) {
  elements.status.textContent = message;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image could not be loaded"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas export failed"));
    }, "image/png");
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 400);
}

function drawPreview(targetCanvas, sourceCanvas) {
  if (!targetCanvas) return;
  const maxWidth = 820;
  const maxHeight = 520;
  const scale = Math.min(maxWidth / sourceCanvas.width, maxHeight / sourceCanvas.height, 1);
  targetCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  targetCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const ctx = targetCanvas.getContext("2d");
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
  targetCanvas.parentElement?.classList.add("has-image");
  if (targetCanvas === elements.beforeCanvas) {
    state.sourcePreview = {
      scale,
      left: targetCanvas.offsetLeft,
      top: targetCanvas.offsetTop,
      width: targetCanvas.width,
      height: targetCanvas.height
    };
  }
}

function clearCanvas(targetCanvas) {
  if (!targetCanvas) return;
  const ctx = targetCanvas.getContext("2d");
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCanvas.parentElement?.classList.remove("has-image");
  if (targetCanvas === elements.beforeCanvas) {
    state.sourcePreview = null;
    renderCropOverlay();
  }
}

function renderCropOverlay() {
  if (!elements.cropOverlay || state.outputMode !== "manual" || !state.manualBounds || !state.sourcePreview) {
    elements.cropOverlay.hidden = true;
    return;
  }

  const { scale, left, top, width, height } = state.sourcePreview;
  elements.cropOverlay.hidden = false;
  elements.cropOverlay.style.left = `${left}px`;
  elements.cropOverlay.style.top = `${top}px`;
  elements.cropOverlay.style.width = `${width}px`;
  elements.cropOverlay.style.height = `${height}px`;
  elements.cropBox.style.left = `${state.manualBounds.x * scale}px`;
  elements.cropBox.style.top = `${state.manualBounds.y * scale}px`;
  elements.cropBox.style.width = `${state.manualBounds.width * scale}px`;
  elements.cropBox.style.height = `${state.manualBounds.height * scale}px`;
}

function resizeCropByHandle(start, handle, dx, dy, sourceSize) {
  let { x, y, width, height } = start;
  const minSize = 8;

  if (handle === "move") {
    x += dx;
    y += dy;
  } else {
    if (handle.includes("w")) {
      x += dx;
      width -= dx;
    }
    if (handle.includes("e")) {
      width += dx;
    }
    if (handle.includes("n")) {
      y += dy;
      height -= dy;
    }
    if (handle.includes("s")) {
      height += dy;
    }
  }

  if (width < minSize) {
    if (handle.includes("w")) x -= minSize - width;
    width = minSize;
  }
  if (height < minSize) {
    if (handle.includes("n")) y -= minSize - height;
    height = minSize;
  }

  return normalizeCropBounds({ x, y, width, height }, sourceSize.width, sourceSize.height);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
