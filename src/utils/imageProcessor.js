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

module.exports = { generatePreview };
