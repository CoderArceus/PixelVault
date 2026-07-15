import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * Client-side image optimization before upload.
 *
 * Parameters:
 *   Max dimension: 1920px — matches Full HD; no phone screen exceeds this.
 *   JPEG quality: 0.8 — visually lossless for photos; standard "high quality" target.
 *   Format: JPEG — universal, matches server expectations.
 *
 * Preserves aspect ratio. Never upscales images already smaller than MAX_DIMENSION.
 *
 * @param {string} uri - Local file URI from image picker
 * @returns {Promise<{
 *   uri: string,
 *   originalSizeBytes: number|null,
 *   processedSizeBytes: number|null,
 *   originalWidth: number,
 *   originalHeight: number,
 *   processedWidth: number,
 *   processedHeight: number,
 *   wasProcessed: boolean
 * }>}
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

/**
 * Get image dimensions from a local URI.
 */
function getImageDimensions(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

/**
 * Get file size in bytes from a local URI via a HEAD-style fetch.
 * Returns null if unavailable (some URIs don't support Content-Length).
 */
async function getFileSize(uri) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size || null;
  } catch {
    return null;
  }
}

/**
 * Format byte count into a human-readable string.
 */
export function formatBytes(bytes) {
  if (bytes == null) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Process an image for upload: resize to max 1920px longest side, compress to JPEG 0.8.
 * Skips processing entirely if both dimensions are already within bounds.
 */
export async function processImageForUpload(uri) {
  const { width, height } = await getImageDimensions(uri);
  const originalSizeBytes = await getFileSize(uri);

  const longestSide = Math.max(width, height);

  // If already within bounds, skip processing — don't re-encode unnecessarily
  if (longestSide <= MAX_DIMENSION) {
    return {
      uri,
      originalSizeBytes,
      processedSizeBytes: originalSizeBytes,
      originalWidth: width,
      originalHeight: height,
      processedWidth: width,
      processedHeight: height,
      wasProcessed: false,
    };
  }

  // Calculate resize dimensions preserving aspect ratio
  const resizeOptions =
    width >= height
      ? { width: MAX_DIMENSION }
      : { height: MAX_DIMENSION };

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: resizeOptions }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  const processedSizeBytes = await getFileSize(result.uri);

  return {
    uri: result.uri,
    originalSizeBytes,
    processedSizeBytes,
    originalWidth: width,
    originalHeight: height,
    processedWidth: result.width,
    processedHeight: result.height,
    wasProcessed: true,
  };
}
