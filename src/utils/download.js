export function downloadImage(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

const ALPHA_THRESHOLD = 8;
const COLOR_TOLERANCE_SQ = 24 * 24;

function sampleColor(data, width, x, y) {
  const idx = (y * width + x) * 4;
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
    a: data[idx + 3],
  };
}

// Determine the background reference from the four corners. Returns either a
// transparent background, or a solid color sampled from the corners.
function detectBackground(imageData) {
  const { data, width, height } = imageData;
  const corners = [
    sampleColor(data, width, 0, 0),
    sampleColor(data, width, width - 1, 0),
    sampleColor(data, width, 0, height - 1),
    sampleColor(data, width, width - 1, height - 1),
  ];

  const transparentCorners = corners.filter((c) => c.a <= ALPHA_THRESHOLD).length;
  if (transparentCorners >= 2) {
    return { transparent: true };
  }

  const avg = corners.reduce(
    (acc, c) => {
      acc.r += c.r;
      acc.g += c.g;
      acc.b += c.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );
  return {
    transparent: false,
    r: Math.round(avg.r / corners.length),
    g: Math.round(avg.g / corners.length),
    b: Math.round(avg.b / corners.length),
  };
}

function isBackgroundPixel(r, g, b, a, bg) {
  if (a <= ALPHA_THRESHOLD) {
    return true;
  }
  if (bg.transparent) {
    return false;
  }
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  return dr * dr + dg * dg + db * db <= COLOR_TOLERANCE_SQ;
}

function getContentBoundingBox(imageData, bg) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isBg = isBackgroundPixel(
        data[idx],
        data[idx + 1],
        data[idx + 2],
        data[idx + 3],
        bg,
      );
      if (!isBg) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png');
  });
}

export async function downloadTrimmedPng(dataUrl, filename) {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bg = detectBackground(imageData);
    const bbox = getContentBoundingBox(imageData, bg);

    if (!bbox) {
      downloadImage(dataUrl, filename);
      return;
    }

    const { minX, minY, maxX, maxY } = bbox;
    const trimmedWidth = maxX - minX + 1;
    const trimmedHeight = maxY - minY + 1;

    if (trimmedWidth === canvas.width && trimmedHeight === canvas.height) {
      downloadImage(dataUrl, filename);
      return;
    }

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    trimmedCtx.drawImage(
      canvas,
      minX,
      minY,
      trimmedWidth,
      trimmedHeight,
      0,
      0,
      trimmedWidth,
      trimmedHeight,
    );

    // Knock out the detected solid background so the saved PNG is transparent.
    if (!bg.transparent) {
      const trimmedData = trimmedCtx.getImageData(0, 0, trimmedWidth, trimmedHeight);
      const px = trimmedData.data;
      for (let i = 0; i < px.length; i += 4) {
        if (isBackgroundPixel(px[i], px[i + 1], px[i + 2], px[i + 3], bg)) {
          px[i + 3] = 0;
        }
      }
      trimmedCtx.putImageData(trimmedData, 0, 0);
    }

    const blob = await canvasToBlob(trimmedCanvas);
    const blobUrl = URL.createObjectURL(blob);
    downloadImage(blobUrl, filename);
    URL.revokeObjectURL(blobUrl);
  } catch {
    downloadImage(dataUrl, filename);
  }
}
