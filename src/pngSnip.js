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
