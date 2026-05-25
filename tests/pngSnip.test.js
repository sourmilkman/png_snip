import { describe, expect, it } from "vitest";
import { centeredPaddedBounds, clampPadding, findOpaqueBounds, outputName, paddedBounds } from "../src/pngSnip.js";

describe("png snip helpers", () => {
  it("finds the visible alpha bounds", () => {
    const data = new Uint8ClampedArray(5 * 4 * 4);
    setAlpha(data, 5, 1, 1, 255);
    setAlpha(data, 5, 3, 2, 255);
    const bounds = findOpaqueBounds({ data, width: 5, height: 4 }, 1);

    expect(bounds).toEqual({ x: 1, y: 1, width: 3, height: 2 });
  });

  it("returns null for fully transparent images", () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    expect(findOpaqueBounds({ data, width: 3, height: 3 }, 1)).toBeNull();
  });

  it("pads bounds without exceeding source dimensions", () => {
    const bounds = paddedBounds({ x: 2, y: 3, width: 4, height: 5 }, 10, 10, 5);
    expect(bounds).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it("preserves the original canvas center when making a centered crop", () => {
    const bounds = centeredPaddedBounds({ x: 245, y: 180, width: 310, height: 240 }, 800, 600, 0);
    expect(bounds).toEqual({ x: 245, y: 180, width: 310, height: 240 });
  });

  it("expands asymmetric bounds around the original center", () => {
    const bounds = centeredPaddedBounds({ x: 280, y: 180, width: 360, height: 240 }, 800, 600, 0);
    expect(bounds).toEqual({ x: 160, y: 180, width: 480, height: 240 });
  });

  it("builds the _snip filename", () => {
    expect(outputName("shirt-art.PNG")).toBe("shirt-art_snip.png");
    expect(outputName("graphic")).toBe("graphic_snip.png");
  });

  it("clamps padding to a useful range", () => {
    expect(clampPadding("-10")).toBe(0);
    expect(clampPadding("42")).toBe(42);
    expect(clampPadding("5000")).toBe(2000);
  });
});

function setAlpha(data, width, x, y, alpha) {
  data[(y * width + x) * 4 + 3] = alpha;
}
