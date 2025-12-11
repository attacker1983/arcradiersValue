// Lightweight wrapper around Tesseract.js to OCR an HTMLCanvas or ImageData.
// Exposes window.doOCR(imageOrCanvas, options) -> Promise<string>
(function () {
  async function doOCR(img, options = {}) {
    // options: lang (default 'eng'), whitelist (e.g. "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-()")
    const lang = options.lang || 'eng';
    const tessOptions = {};
    if (options.whitelist) tessOptions.tessedit_char_whitelist = options.whitelist;
    const worker = Tesseract.createWorker({
      logger: m => {
        /* logger disabled to reduce noise */
      }
    });
    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    if (Object.keys(tessOptions).length) {
      await worker.setParameters(tessOptions);
    }
    const { data: { text } } = await worker.recognize(img);
    await worker.terminate();
    return text;
  }

  window.doOCR = doOCR;
})();