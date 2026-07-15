const sharp = require('sharp');

/**
 * Generate a blurred, downscaled preview from an image buffer.
 * Per TRD §4: preview is a genuinely separate blurred asset — not the
 * original obscured client-side. Stored as a distinct S3 object.
 *
 * @param {Buffer} buffer - Original image buffer
 * @returns {Promise<Buffer>} Blurred preview as JPEG buffer
 */
async function generatePreview(buffer) {
  return sharp(buffer)
    .resize({ width: 400, withoutEnlargement: true })
    .blur(20)
    .jpeg({ quality: 60 })
    .toBuffer();
}

/**
 * Optimize the original image before storage in S3.
 * Applied once at upload time — NOT on every future request.
 *
 * Parameter choices (deliberate, not arbitrary):
 *   Max dimension: 2048px — slightly above the client-side cap (1920px) so a
 *     client-optimized image passes through untouched. Covers 2K displays.
 *     No phone screen renders more pixels than this in either axis.
 *   JPEG quality: 85 — higher than the client-side 80 and preview 60 because
 *     this is the "original" that paying users unlock, so quality matters more.
 *     85 is the standard "high quality" JPEG threshold; visually indistinguishable
 *     from 100 on photographic content while saving 40-60% file size.
 *   withoutEnlargement: true — never upscale a small image; same policy as previews.
 *   Format: JPEG — consistent with existing pipeline. WebP would save ~25% more
 *     but requires extension/MIME changes throughout the codebase.
 *
 * @param {Buffer} buffer - Raw upload buffer from multer
 * @returns {Promise<Buffer>} Optimized image as JPEG buffer
 */
async function optimizeOriginal(buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // If it's already a JPEG and within bounds, return the original buffer unchanged
  // to avoid double-compressing client-optimized images.
  if (metadata.format === 'jpeg' && metadata.width <= 2048 && metadata.height <= 2048) {
    return buffer;
  }

  return image
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

module.exports = { generatePreview, optimizeOriginal };
