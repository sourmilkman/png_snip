import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, Download, FileImage, FolderOpen, Scissors, Sparkles, Upload, XCircle } from "lucide-react";
import { clampPadding, findOpaqueBounds, outputName, paddedBounds } from "./pngSnip.js";
import "./styles.css";

const APP_VERSION = "0.1.1";

function App() {
  const [fileInfo, setFileInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [padding, setPadding] = useState(0);
  const [outputMode, setOutputMode] = useState("tight");
  const [autoSave, setAutoSave] = useState(true);
  const [status, setStatus] = useState("Drop a transparent PNG to snip it.");
  const [isDragging, setIsDragging] = useState(false);
  const beforeRef = useRef(null);
  const afterRef = useRef(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, []);

  const processFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
        setStatus("PNG Snip only accepts PNG files.");
        setResult(null);
        return;
      }

      setStatus("Reading PNG pixels...");
      const image = await loadImage(file);
      const sourceCanvas = document.createElement("canvas");
      const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;
      sourceCtx.drawImage(image, 0, 0);

      const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const bounds = findOpaqueBounds(imageData, 2);
      if (!bounds) {
        setStatus("No visible pixels found. The PNG appears fully transparent.");
        setResult(null);
        drawPreview(beforeRef.current, sourceCanvas);
        clearCanvas(afterRef.current);
        return;
      }

      const cleanPadding = clampPadding(padding);
      const crop = paddedBounds(bounds, sourceCanvas.width, sourceCanvas.height, cleanPadding);
      const outputCanvas = document.createElement("canvas");
      const outputCtx = outputCanvas.getContext("2d");

      if (outputMode === "original") {
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
      const nextResult = {
        blob,
        url: URL.createObjectURL(blob),
        fileName: outputName(file.name),
        bounds,
        crop,
        source: { width: sourceCanvas.width, height: sourceCanvas.height },
        output: { width: outputCanvas.width, height: outputCanvas.height }
      };

      setFileInfo({ name: file.name, size: file.size, width: sourceCanvas.width, height: sourceCanvas.height });
      setResult((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return nextResult;
      });
      drawPreview(beforeRef.current, sourceCanvas);
      drawPreview(afterRef.current, outputCanvas);
      setStatus(`Ready: ${nextResult.fileName}`);

      if (autoSave) {
        window.setTimeout(() => downloadBlob(nextResult.blob, nextResult.fileName), 80);
      }
    },
    [autoSave, outputMode, padding]
  );

  const stats = useMemo(() => {
    if (!result) return [];
    return [
      ["Source", `${result.source.width} x ${result.source.height}`],
      ["Graphic bounds", `${result.bounds.width} x ${result.bounds.height}`],
      ["Output", `${result.output.width} x ${result.output.height}`],
      ["File", result.fileName]
    ];
  }, [result]);

  return (
    <main className="app-shell" data-version={APP_VERSION}>
      <header className="topbar">
        <div className="brand">
          <Scissors size={26} />
          <div>
            <h1>PNG Snip</h1>
            <span>v{APP_VERSION} · local transparent PNG cropper</span>
          </div>
        </div>
        <div className="status-pill">
          {result ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
          {status}
        </div>
      </header>

      <section className="workflow">
        <section
          className={`drop-zone ${isDragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            processFile(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload size={36} />
          <h2>Drop a PNG here</h2>
          <p>PNG Snip trims transparent whitespace, centers the visible graphic, then autosaves a local copy ending in <strong>_snip.png</strong>.</p>
          <label className="file-button">
            <FolderOpen size={18} />
            Choose PNG
            <input type="file" accept="image/png" onChange={(event) => processFile(event.target.files?.[0])} />
          </label>
        </section>

        <aside className="controls">
          <div className="panel-title">Snip settings</div>
          <label className="control">
            Padding
            <input type="number" min="0" max="2000" value={padding} onChange={(event) => setPadding(clampPadding(event.target.value))} />
          </label>
          <div className="segmented" role="group" aria-label="Output mode">
            <button className={outputMode === "tight" ? "active" : ""} onClick={() => setOutputMode("tight")}>Tight crop</button>
            <button className={outputMode === "original" ? "active" : ""} onClick={() => setOutputMode("original")}>Original size</button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={autoSave} onChange={(event) => setAutoSave(event.target.checked)} />
            Auto-download after snip
          </label>
          <button className="download-button" disabled={!result} onClick={() => result && downloadBlob(result.blob, result.fileName)}>
            <Download size={18} />
            Download _snip.png
          </button>
        </aside>
      </section>

      <section className="preview-grid">
        <PreviewPanel title="Before" canvasRef={beforeRef} emptyText="Original PNG preview" />
        <PreviewPanel title="After" canvasRef={afterRef} emptyText="Snipped and centered preview" />
      </section>

      <section className="details">
        <div className="panel-title"><FileImage size={18} /> Output details</div>
        {fileInfo ? (
          <div className="stats-grid">
            {stats.map(([label, value]) => (
              <div className="stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-details">
            <XCircle size={18} />
            No PNG loaded yet.
          </div>
        )}
      </section>
    </main>
  );
}

function PreviewPanel({ title, canvasRef, emptyText }) {
  return (
    <section className="preview-panel">
      <div className="panel-title">{title}</div>
      <div className="checkerboard">
        <canvas ref={canvasRef} aria-label={`${title} canvas`} />
        <span>{emptyText}</span>
      </div>
    </section>
  );
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
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

createRoot(document.getElementById("root")).render(<App />);
