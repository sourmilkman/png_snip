import { centeredPaddedBounds, clampPadding, findOpaqueBounds, outputName } from "./pngSnip.js";

const APP_VERSION = "0.1.4";

const state = {
  outputMode: "tight",
  result: null,
  lastFile: null
};

const elements = {
  status: document.querySelector("#status"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  paddingInput: document.querySelector("#paddingInput"),
  tightMode: document.querySelector("#tightMode"),
  originalMode: document.querySelector("#originalMode"),
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

elements.paddingInput.addEventListener("change", () => {
  elements.paddingInput.value = clampPadding(elements.paddingInput.value);
  if (state.lastFile) processFile(state.lastFile);
});

elements.tightMode.addEventListener("click", () => {
  setMode("tight");
});

elements.originalMode.addEventListener("click", () => {
  setMode("original");
});

elements.downloadButton.addEventListener("click", () => {
  if (state.result) downloadBlob(state.result.blob, state.result.fileName);
});

async function processFile(file) {
  if (!file) return;
  if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
    updateStatus("PNG Snip only accepts PNG files.");
    state.result = null;
    elements.downloadButton.disabled = true;
    return;
  }

  state.lastFile = file;
  updateStatus("Reading PNG pixels...");

  try {
    const image = await loadImage(file);
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
    const crop = centeredPaddedBounds(bounds, sourceCanvas.width, sourceCanvas.height, padding);
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
    state.result = {
      blob,
      fileName: outputName(file.name),
      bounds,
      source: { width: sourceCanvas.width, height: sourceCanvas.height },
      output: { width: outputCanvas.width, height: outputCanvas.height }
    };

    drawPreview(elements.beforeCanvas, sourceCanvas);
    drawPreview(elements.afterCanvas, outputCanvas);
    renderDetails(state.result);
    elements.downloadButton.disabled = false;
    updateStatus(`Ready: ${state.result.fileName}`);
  } catch (error) {
    updateStatus(`Could not process PNG: ${error.message}`);
  }
}

function setMode(mode) {
  state.outputMode = mode;
  elements.tightMode.classList.toggle("active", mode === "tight");
  elements.originalMode.classList.toggle("active", mode === "original");
  if (state.lastFile) processFile(state.lastFile);
}

function renderDetails(result) {
  const rows = [
    ["Source", `${result.source.width} x ${result.source.height}`],
    ["Graphic bounds", `${result.bounds.width} x ${result.bounds.height}`],
    ["Output", `${result.output.width} x ${result.output.height}`],
    ["File", result.fileName]
  ];

  elements.detailsBody.className = "stats-grid";
  elements.detailsBody.innerHTML = rows
    .map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
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
}

function clearCanvas(targetCanvas) {
  if (!targetCanvas) return;
  const ctx = targetCanvas.getContext("2d");
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCanvas.parentElement?.classList.remove("has-image");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
