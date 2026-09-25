// src/photos.js — модуль работы с фотографиями
// Отвечает за сжатие изображений и оценку размера.

const PhotoUtils = (() => {

    /**
     * Сжимает изображение до maxSize по большей стороне.
     * @param {File} file - файл изображения
     * @param {number} maxSize - максимум пикселей по большей стороне
     * @param {number} quality - качество JPEG (0..1)
     * @returns {Promise<string>} data URL в формате JPEG
     */
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

    /**
     * Оценивает размер data URL в килобайтах.
     * @param {string} dataUrl
     * @returns {number} размер в КБ
     */
    function sizeKb(dataUrl) {
        return Math.round(dataUrl.length * 0.75 / 1024);
    }

    return { compressImage, sizeKb };
})();