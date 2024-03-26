import {
  createC2pa,
  createL2ManifestStore,
  generateVerifyUrl,
} from "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/+esm";
import "https://cdn.jsdelivr.net/npm/c2pa-wc@0.10.15/+esm";

((Drupal, once) => {

  Drupal.c2pa = Drupal.c2pa || {};

  /**
   * get the source file for the element so different element types can be used
   *
   * TODO: picture
   *
   * @param element
   * @returns {*}
   */
  Drupal.c2pa.elementSrc = function(element) {
    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
      case 'img':
        return element.src;
        break;
      case 'video':
      case 'audio':
        // grab the first source in the hopes that the first source is the best option
        const sources = element.querySelectorAll('source');
        return sources[0].src;
        break;
    }
  }

  Drupal.behaviors.c2pa = {
    async attach() {
      once("init-c2pa", "html").forEach(async (element) => {
        const c2pa = await createC2pa({
          wasmSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/dist/assets/wasm/toolkit_bg.wasm",
          workerSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/dist/c2pa.worker.min.js",
        });

        element.querySelectorAll(".c2pa-wrapper").forEach(async (wrapper) => {
          const element = wrapper.querySelector("img, audio, video, picture");
          const src = Drupal.c2pa.elementSrc(element);
          const result = await c2pa.read(src);
          const manifestStoreResult = await createL2ManifestStore(
            result.manifestStore
          );

          const popover = document.createElement("cai-popover");
          popover.placement = "left-start";
          popover.interactive = true;

          const indicator = document.createElement("cai-indicator");
          indicator.slot = "trigger";

          const manifestSummary = document.createElement(
            "cai-manifest-summary"
          );
          manifestSummary.slot = "content";
          manifestSummary.manifestStore = manifestStoreResult.manifestStore;
          manifestSummary.viewMoreUrl = generateVerifyUrl(src);

          popover.appendChild(manifestSummary);
          popover.appendChild(indicator);

          wrapper.prepend(popover);
        });
      });
    },
  };

})(Drupal, once);
