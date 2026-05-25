export function findOpaqueBounds(imageData, alphaThreshold = 1) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

export function outputName(fileName) {
  return fileName.replace(/\.png$/i, "") + "_snip.png";
}

export function clampPadding(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(parsed, 2000));
}

export function paddedBounds(bounds, sourceWidth, sourceHeight, padding) {
  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  const right = Math.min(sourceWidth, bounds.x + bounds.width + padding);
  const bottom = Math.min(sourceHeight, bounds.y + bounds.height + padding);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

export function centeredPaddedBounds(bounds, sourceWidth, sourceHeight, padding) {
  const centerX = sourceWidth / 2;
  const centerY = sourceHeight / 2;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const halfWidth = Math.ceil(Math.max(centerX - bounds.x, right - centerX) + padding);
  const halfHeight = Math.ceil(Math.max(centerY - bounds.y, bottom - centerY) + padding);
  const width = Math.min(sourceWidth, halfWidth * 2);
  const height = Math.min(sourceHeight, halfHeight * 2);
  const x = clamp(Math.round(centerX - width / 2), 0, sourceWidth - width);
  const y = clamp(Math.round(centerY - height / 2), 0, sourceHeight - height);

  return { x, y, width, height };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
