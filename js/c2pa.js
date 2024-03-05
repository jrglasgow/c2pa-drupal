import {
  createC2pa,
  createL2ManifestStore,
  generateVerifyUrl,
} from "https://cdn.jsdelivr.net/npm/c2pa@0.14.4/+esm";
import "https://cdn.jsdelivr.net/npm/c2pa-wc@0.10.15/+esm";

((Drupal, once, drupalSettings) => {
  Drupal.behaviors.c2pa = {
    async attach(context, settings) {
      once("init-c2pa", ".c2pa-wrapper", context).forEach(async (wrapper) => {
        const c2pa = await createC2pa({
          wasmSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.14.4/dist/assets/wasm/toolkit_bg.wasm",
          workerSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.14.4/dist/c2pa.worker.min.js",
        });

        wrapper.querySelectorAll("img").forEach(async (image) => {
          const result = await c2pa.read(image);
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
          manifestSummary.viewMoreUrl = generateVerifyUrl(image.src);

          popover.appendChild(manifestSummary);
          popover.appendChild(indicator);

          wrapper.prepend(popover);
        });
      });
    },
  };
})(Drupal, once, drupalSettings);
