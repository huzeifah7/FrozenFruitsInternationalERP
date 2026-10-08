/**
 * Client-side image loader service for canvas manipulation and PDF exports.
 * Fetches the image as a blob if possible to prevent CORS canvas taint, or uses direct img.src.
 */
export async function loadImageClientSide(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        };
        img.src = objectUrl;
      });
    }
  } catch (e) {
    console.warn('Direct fetch of image failed, attempting standard image load:', e);
  }

  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}
