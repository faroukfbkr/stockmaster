/**
 * Client-side utility to compress images using HTML Canvas.
 * Ensures uploaded or captured photos are compact (under ~100KB) to save storage.
 */
export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 800,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }
      
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get 2D context from canvas"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get compressed JPEG data URL
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };
    
    img.onerror = (err) => {
      reject(err);
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          img.src = e.target.result;
        } else {
          reject(new Error("FileReader failed to read image file"));
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
