import {
  createC2pa,
  createL2ManifestStore,
  generateVerifyUrl,
} from "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/+esm";
import "https://cdn.jsdelivr.net/npm/c2pa-wc@0.10.15/+esm";
//import '/libraries/c2pa-js/packages/c2pa-wc/dist/index.js'
import { computePosition, autoUpdate } from 'https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.3.0/+esm';


((Drupal, once, drupalSettings) => {

  window.process = {
    'env': {
      'NODE_ENV': "development"
    }
  }
  Drupal.c2pa = Drupal.c2pa || {};

  /**
   * from the element construct an Id tag using usique data including the tagName, the attributes of the tag and a
   * counter
   *
   * @param element
   * @returns String
   */
  Drupal.c2pa.idFromElement = async function(element) {
    // add various data to an array to get something unique
    let id = [];
    // include a counter
    id.push(Drupal.c2pa.elementCount());
    id.push(element.tagName.toLowerCase());
    for (let key in element.attributes) {
      id.push(element.attributes[key].toString());
    }
    id.push(element.attributes)
    // turn the array into a string
    const idString = JSON.stringify(id);
    return Drupal.c2pa.sha256(idString).then(function(result){return element.tagName.toLowerCase() + '-' + result});
  }

  /**
   * get a sha256 has from a string
   *
   * @param string
   * @returns {Promise<string>}
   */
  Drupal.c2pa.sha256 = async function(string) {
    const utf8 = new TextEncoder().encode(string);
    return crypto.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
      return hashHex;
    });
  }

  /**
   * get a unique count of elements
   *
   * @returns {number|*}
   */
  Drupal.c2pa.elementCount = function() {
    drupalSettings.c2pa = drupalSettings.c2pa || {}
    if (typeof drupalSettings.c2pa.count == 'undefined') {
      drupalSettings.c2pa.count = 0;
    }
    else {
      drupalSettings.c2pa.count += 1;
    }
    return drupalSettings.c2pa.count;
  }

  Drupal.behaviors.c2pa = {
    async attach(context, settings) {
      // only act once on the .c2pa-wrapper classed elements in the current context
      once("init-c2pa", ".c2pa-wrapper", context).forEach(async (wrapper) => {
        const c2pa = await createC2pa({
          wasmSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/dist/assets/wasm/toolkit_bg.wasm",
          workerSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/dist/c2pa.worker.min.js",
        });

        // within the .c2pa-wrapper find only img elements
        wrapper.querySelectorAll("img").forEach(async (image) => {
          const result = await c2pa.read(image);
          const manifestStoreResult = await createL2ManifestStore(
            result.manifestStore
          );
          const element = image;
          const id = await Drupal.c2pa.idFromElement(element);

          const src = Drupal.c2pa.elementSrc(element);

          // get the rendered manifest
          let manifestMarkup = await Drupal.theme('c2paManifestSummary', manifestStoreResult, src)
          const manifestSummary = new DOMParser().parseFromString(manifestMarkup, "text/html").firstChild;
          console.log('manifestSummary', manifestSummary);

          // create the info button
          const button = document.createElement('button');
          button.textContent = Drupal.t('View Content Credentials');
          button.setAttribute('popovertarget', id);
          button.setAttribute('class', 'c2pa-indicator-button');
          button.setAttribute('title', Drupal.t('View Content Credentials'));

          // create the popover
          const popover = document.createElement('div');
          popover.setAttribute('id', id);
          popover.setAttribute('class', 'c2pa-popover');
          popover.setAttribute('popover', 'auto');
          popover.appendChild(manifestSummary);
          popover.addEventListener('toggle', Drupal.c2pa.positionPopover);

          wrapper.append(button);
          wrapper.append(popover);
          Drupal.attachBehaviors();
        });

      });

      once('info-popover-processed', '.info-popover-popover', context).forEach(async (popover) => {
        popover.addEventListener('toggle', Drupal.c2pa.positionPopover);
      });

      once("popovertarget-hover", "button[popovertarget]", context).forEach(async (button) => {
        console.log('button', button);
/*
        button.addEventListener('mouseover', (event) => {
          event.target.popoverTargetElement.showPopover();
        });
        button.addEventListener('focus', (event) => {
          event.target.popoverTargetElement.showPopover();
        })
        button.addEventListener('mouseout', (event) => {
          // check to make sure the mouse isn't over the target popover
          event.target.popoverTargetElement.hidePopover();
        });
        button.addEventListener('blur', (event) => {
          // check to make sure the focus isn't inside the popover
          event.target.popoverTargetElement.hidePopover();
        });

/* */
      });

    },
  };

  Drupal.c2pa.elementSrc = function(element) {
    console.log('element', element);
    const tagName = element.tagName.toLowerCase();
    console.log('tagName', tagName);
    switch (tagName) {
      case 'img':
        return element.src;
        break;
    }
  }

  /**
   * Use Floating UI to position the popover
   * this is from https://codepen.io/hidde/pen/wvQaRJy/fc4f308d20a3a3118ead55e6553a7d66?editors=1011
   *
   * @param event
   */
  Drupal.c2pa.positionPopover = function(event) {
    const popover = event.target;
    const invoker = document.querySelector(`[popovertarget="${popover.getAttribute('id')}"`);

    if (event.newState === 'open') {
      const cleanup = autoUpdate(invoker, popover, () => {
        computePosition(invoker, popover, { placement: 'left-start' }).then(({x, y}) => {
          Object.assign(popover.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        });
      });
      return cleanup;
    }
  }


  Drupal.theme.c2paManifestSummary = async function(manifestSummary, src) {
    let c2paSignatureInformation = await Drupal.theme('c2paSignatureInformation', manifestSummary)
    let claimGenerator = await Drupal.theme('c2paClaimGenerator', manifestSummary);
    let verifyUrl = await Drupal.theme('c2paVerifyUrl', manifestSummary, src);
    let editsAndActivity = await Drupal.theme('c2paEditsAndActivity', manifestSummary.manifestStore.editsAndActivity);
    let assetsUsed = await Drupal.theme('c2paAssetsUsed', manifestSummary.manifestStore.ingredients);
    let html = `
<div class="c2pa-manifest-summary">
    ${c2paSignatureInformation}
    ${claimGenerator}
    ${editsAndActivity}
    ${assetsUsed}
    ${verifyUrl}
</div>`;
    return html;
  };

  /**
   * from the message construct an ID tag using unique data including a counter
   *
   * @param element
   * @returns String
   */
  Drupal.c2pa.tooltipIdFromMessage = async function(message) {
    const idString = message + '-' + Drupal.c2pa.elementCount();
    return Drupal.c2pa.sha256(idString).then(function(result){return result});
  }

  Drupal.theme.c2paInfoItem = async function(message) {
    let popoverId = await Drupal.c2pa.tooltipIdFromMessage(message);
    popoverId = 'info-' + popoverId;
    let label = Drupal.t('More Information');
    return `
    <button class="info-popover-button" popovertarget="${popoverId}" title="${message}">${label}</button>
    <div popover id="${popoverId}" class="info-popover-popover">${message}</div>
`;
  }

  Drupal.theme.c2paAssetsUsed = async function(ingredients) {
    let title = Drupal.t('Assets used');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Any assets used or added to this content'));
    let items = [];
    ingredients.forEach((thisIngredient) => {
      let ingredientTitle = Drupal.t('A thumbnail of a file used as an ingredient to make this media asset: @fileName.', {'@fileName': thisIngredient.title});
      if (thisIngredient.hasManifest) {
        ingredientTitle += ' ' + Drupal.t('A Content Credentials logo (the letters CR in a speech bubble) hovers over this imsage signifying that this ingredient contains a manifest.');
      }
      let ingredientClass = thisIngredient.hasManifest ? 'has-manifest' : 'no-manifest';
      let thisIngredientMarkup = `<img alt="${ingredientTitle}" src="${thisIngredient.thumbnail}"/>`
      items.push(`<li class="${ingredientClass}" data-format="${thisIngredient.format}" data-has-manifest="${thisIngredient.hasManifest}">${thisIngredientMarkup}</li>`);
    });
    items = items.join('');
    items = `<ul>${items}</ul>`;
    return `
<section class="ingredients">
  <h4>${title}${infoIcon}</h4>
    ${items}
  <hr/>
</section>`
  }


  /**
   * Template for markup for the activity (c2pa.actions) for the most recent manifest
   *
   * @param manifestSummary
   * @returns {string}
   */
  Drupal.theme.c2paEditsAndActivity = async function(editsAndActivity) {
    let title = Drupal.t('Edits and Activity');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Changes and actions taken to produce this content'));
    let edits = [];
    editsAndActivity.forEach((thisEdit) => {
      let thisEditMarkup = Drupal.theme('c2paSingleEdit', thisEdit);
      edits.push(thisEditMarkup);
    });
    edits = edits.join("\n");
    return `
<section class="edits-and-activity">
  <h4>${title}${infoIcon}</h4>
    ${edits}
</section>`
  }

  Drupal.theme.c2paSingleEdit = function(edit) {

    let label = Drupal.t(edit.label);
    let description = Drupal.t(edit.description);
    let iconTitle = Drupal.t('Icon for @label', {'@label': edit.label});
    let icon = edit.icon ? `<img class="icon" src="${edit.icon}" alt="${iconTitle}"/>` : '';
    return `
<dt class="label" data-edit-id="${edit.id}">${icon}<span class="section-edits-and-activity-list-item-label">${label}</span></dt>
<dd class="edit-description">${description}</dd>
`;
  }

  Drupal.theme.c2paVerifyUrl = function(manifestSummary, src) {
    const url = generateVerifyUrl(src);
    const linkText = Drupal.t('View more');
    return `<a class="view-more" href="${url}" target="_blank">${linkText}</a>`;
  }

  Drupal.theme.c2paClaimGenerator = async function(manifestSummary) {
    let claimGenerator = manifestSummary.manifestStore.claimGenerator.product;
    let title = Drupal.t('Produced With');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Software used to make this content'));
    let claimTitle = Drupal.t('Software that generated the manifest and claim.');
    return `
<section class="produced-by">
  <h4>${title}${infoIcon}</h4>

  <span class="claim-generator" aria-label="${claimTitle}" title="${claimTitle}">${claimGenerator}</span>
</section>`
  }

  Drupal.theme.c2paSignatureInformation = async function(manifestSummary) {
    let ccTitle = Drupal.t("Content Credentials");
    let issuer = manifestSummary.manifestStore.signature.issuer;
    let signDate = new Date(manifestSummary.manifestStore.signature.isoDateString);
    let signDateString = signDate.toLocaleDateString() + ' ' +  signDate.toLocaleTimeString();
    let dateTitle = Drupal.t('Manifest signature date');
    let issuerTitle = Drupal.t('signing certificate subjet organization name');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Attribution and history data attached to this content'));
    let html = `
<section class="signature-information">
    <h4>${ccTitle}${infoIcon}</h4>
    <dt class="cert-issuer"><span class="cert-issuer" aria-label="${issuerTitle}" title="${issuerTitle}">${issuer}</span></dt>
    <dd class="signature-date"><span class="signature-date" aria-label="${dateTitle}" title="${dateTitle}">${signDateString}</span></dd>
</section>
`;
    return html;
  }
})(Drupal, once, drupalSettings);
