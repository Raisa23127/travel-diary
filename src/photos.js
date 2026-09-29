// =========================================================
// photos.js — модуль работы с фотографиями
// =========================================================

const PhotoUtils = (() => {

    function compressImage(file, maxSize = 1200, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
            reader.onload = e => {
                const img = new Image();
                img.onerror = () => reject(new Error('Не изображение'));
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                        if (width >= height) {
                            height = Math.round(height * maxSize / width);
                            width = maxSize;
                        } else {
                            width = Math.round(width * maxSize / height);
                            height = maxSize;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function sizeKb(dataUrl) {
        return Math.round(dataUrl.length * 0.75 / 1024);
    }

    function getTotalPhotos(trips) {
        return trips.reduce((sum, t) =>
            sum + (Array.isArray(t.photos) ? t.photos.length : 0), 0);
    }

    return { compressImage, sizeKb, getTotalPhotos };
})();