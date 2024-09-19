import {
  createC2pa,
  createL2ManifestStore,
  generateVerifyUrl,
} from "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/+esm";
import "https://cdn.jsdelivr.net/npm/c2pa-wc@0.10.15/+esm";
/* instead of using the c2pa web componentslibrary which is inaccessible create our own HTML compatible popover */
//import '/libraries/c2pa-js/packages/c2pa-wc/dist/index.js'
import { computePosition, autoUpdate, autoPlacement } from 'https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.3.0/+esm';


(($, Drupal, once, drupalSettings) => {

  /**
   * prevent Floating UI from complaining about the variable not existing and breaking
   * @type {{env: {NODE_ENV: string}}}
   */
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
    // include a counter to ensure we have unique date
    id.push(Drupal.c2pa.elementCount());
    // add the tag name
    id.push(element.tagName.toLowerCase());
    for (let key in element.attributes) {
      id.push(element.attributes[key].toString());
    }
    id.push(element.attributes)
    // turn the array into a string
    const idString = JSON.stringify(id);
    // create a sha256 hash of the string and return "tagname-{hash}" as the ID
    return Drupal.c2pa.sha256(idString).then(function(result){return element.tagName.toLowerCase() + '-' + result});
  }

  /**
   * get a sha256 hash from a string
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
   * get a unique count of elements so no ID will be the same
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
      once("init-c2pa", ".c2pa-wrapper", context).forEach(async (wrapper) => {
        const c2pa = await createC2pa({
          wasmSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/dist/assets/wasm/toolkit_bg.wasm",
          workerSrc:
            "https://cdn.jsdelivr.net/npm/c2pa@0.17.8/dist/c2pa.worker.min.js",
        });

        wrapper.querySelectorAll("img, video, audio, picture").forEach(async (element) => {
          const src = Drupal.c2pa.elementSrc(element);
          const result = await c2pa.read(src);
          let manifestStore = result.manifestStore;
          if (manifestStore === null) {
            // if there is no manifests, skip it
            return;
          }
          const manifestStoreResult = await createL2ManifestStore(
            result.manifestStore
          );
          const id = await Drupal.c2pa.idFromElement(element);

          // get the rendered manifest
          let manifestMarkup = await Drupal.theme('c2paManifestSummary', manifestStoreResult, src, result.source);
          const manifestSummary = new DOMParser().parseFromString(manifestMarkup, "text/html").firstChild;

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

          // add the elements to the wrapper
          wrapper.append(button);
          wrapper.append(popover);
          Drupal.attachBehaviors();
        });

      });

      once('info-popover-processed', '.info-popover-popover', context).forEach(async (popover) => {
        popover.addEventListener('toggle', Drupal.c2pa.positionPopover);
      });

      once("popovertarget-hover", "button[popovertarget]", context).forEach(async (button) => {
        //button.addEventListener()
        /**
         * TODO: Ideally not just keyboard events ('space', 'enter') or mouse click would trigger the popover,
         * also the move over would trigger it along with the triggering element receiving keyboard docus,
         * unfortunately with the code below as soon as the 'mouseout' event, or keyboard 'blur' event occurs the
         * popover hides and the mouse/keyboard won't be able to do anything inside the popover, this needs some
         * rethinking so it can be made to work.
         *
         * We possibly need to do something like the "Nested Popover menu example" - see
         * https://mdn.github.io/dom-examples/popover-api/
         *
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
        computePosition(invoker, popover, { middleware: [autoPlacement()] }).then(({x, y}) => {
          let thisPosition = 'absolute';
          let thisPopoverClass = $(popover).attr('class');
          if (thisPopoverClass.search(':popover-open') == -1) {
            // popover is supported  we don't do anything extra
          }
          else {
            // popover is not supported
            let thisClass = invoker.getAttribute('class');
            if (thisClass == 'info-popover-button') {
              // only act on the inner popovers as the outer popover has no issues
              thisPosition = 'fixed';
              const invokerPosition = $(invoker).fixedPosition();
              const popoverOffset = $(popover).offset();
              //x = invokerPosition.x ;
              y = invokerPosition.y;
            }
          }
          const newStyles = {
            left: `${x}px`,
            top: `${y}px`,
            position: thisPosition
          };
          Object.assign(popover.style, newStyles);
        });
      });
      return cleanup;
    }
  }

  $.fn.outerOffset = function () {
    /// <summary>Returns an element's offset relative to its outer size; i.e., the sum of its left and top margin, padding, and border.</summary>
    /// <returns type="Object">Outer offset</returns>
    var margin = this.margin();console.log('margin', margin);
    var padding = this.padding();console.log('padding', padding);
    var border = this.border();console.log('border', border);
    return {
      left: margin.left + padding.left + border.left,
      top: margin.top + padding.top + border.top
    }
  };

  $.fn.fixedPosition = function () {
    /// <summary>Returns the "fixed" position of the element; i.e., the position relative to the browser window.</summary>
    /// <returns type="Object">Object with 'x' and 'y' properties.</returns>
    var offset = this.offset();console.log('offset', offset);
    var $doc = $(document);console.log('$doc', $doc);console.log('$doc.scrollLeft()', $doc.scrollLeft());console.log('$doc.scrollTop()', $doc.scrollTop());
    var bodyOffset = $(document.body).outerOffset();console.log('bodyOffset', bodyOffset);
    return {
      x: offset.left - $doc.scrollLeft() + bodyOffset.left,
      y: offset.top - $doc.scrollTop() + bodyOffset.top
    };
  };


  /**
   * generate all of the markup for the manifest summary popover contents
   *
   * @param manifestSummary
   * @param src
   * @returns {Promise<string>}
   */
  Drupal.theme.c2paManifestSummary = async function(manifestSummary, srcUrl, manifestSource) {
    console.log('drupalSettings.c2pa', drupalSettings.c2pa);
    let c2paSignatureInformation = (drupalSettings.c2pa.content_credentials ?? true) ? await Drupal.theme('c2paSignatureInformation', manifestSummary, manifestSource) : '';
    let claimGenerator = (drupalSettings.c2pa.produced_with ?? true) ? await Drupal.theme('c2paClaimGenerator', manifestSummary) : '';
    let verifyUrl = (drupalSettings.c2pa.view_more ?? true) ? await Drupal.theme('c2paVerifyUrl', manifestSummary, srcUrl) : '';
    let editsAndActivity = (drupalSettings.c2pa.edits_and_activities ?? true) ? await Drupal.theme('c2paEditsAndActivity', manifestSummary.manifestStore.editsAndActivity) : '';
    let assetsUsed = (drupalSettings.c2pa.assets_used ?? true) ? await Drupal.theme('c2paAssetsUsed', manifestSummary.manifestStore.ingredients, manifestSource) : '';
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

  /**
   * create te markup for the infor item popover
   *
   * @param message
   * @returns {Promise<string>}
   */
  Drupal.theme.c2paInfoItem = async function(message) {
    let popoverId = await Drupal.c2pa.tooltipIdFromMessage(message);
    popoverId = 'info-' + popoverId;
    let label = Drupal.t('More Information');
    return `
    <button class="info-popover-button" popovertarget="${popoverId}" title="${message}">${label}</button>
    <div popover id="${popoverId}" class="info-popover-popover">${message}</div>
`;
  }

  /**
   * create a list of the assets used for this manifest
   *
   * @param ingredients
   * @returns {Promise<string>}
   */
  Drupal.theme.c2paAssetsUsed = async function(ingredients) {
    let title = Drupal.t('Assets used');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Any assets used or added to this content'));
    let items = [];
    ingredients.forEach((thisIngredient) => {
      let ingredientTitle = Drupal.t('A thumbnail of a file used as an ingredient to make this media asset: @fileName.', {'@fileName': thisIngredient.title});
      if (thisIngredient.hasManifest) {
        ingredientTitle += ' ' + Drupal.t('A Content Credentials logo (the letters CR in a speech bubble) hovers over this image signifying that this ingredient contains a manifest.');
      }
      let ingredientClass = thisIngredient.hasManifest ? 'has-manifest' : 'no-manifest';
      let emptyText = Drupal.t('This ingredient contains no thumbnail.');
      let thisIngredientMarkup = `<a title="${ingredientTitle} ${emptyText}" class="image-thumb empty" href="#"><span class="hidden">${emptyText}</span><a/>`;

      if (thisIngredient.thumbnail) {
        thisIngredientMarkup = `<img alt="${ingredientTitle}" src="${thisIngredient.thumbnail}"/>`;
      }
      else {

      }
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

  /**
   * information for a single edit action
   *
   * @param edit
   * @returns {`
<dt class="label" data-edit-id="${string}">${string|string}<span class="section-edits-and-activity-list-item-label">${string}</span></dt>
<dd class="edit-description">${string}</dd>
`}
   */
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

  /**
   * create a link to https://contentcredentials.org/verify with the asset in a parameter to open that asset and show
   * manifest information
   *
   * @param manifestSummary
   * @param src
   * @returns {`<a class="view-more" href="${*}" target="_blank">${string}</a>`}
   */
  Drupal.theme.c2paVerifyUrl = function(manifestSummary, src) {
    const url = generateVerifyUrl(src);
    const linkText = Drupal.t('View more');
    return `<a class="view-more" href="${url}" target="_blank">${linkText}</a>`;
  }

  /**
   * display claim generator information
   *
   * @param manifestSummary
   * @returns {Promise<string>}
   */
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

  /**
   * display information about the signature
   *
   * @param manifestSummary
   * @returns {Promise<string>}
   */
  Drupal.theme.c2paSignatureInformation = async function(manifestSummary, manifestSource) {
    let ccTitle = Drupal.t("Content Credentials");
    let thumbnailTitle = Drupal.t('');
    let thumbnailMarkup = `<a href="#">${thumbnailTitle}</a>`;

    let url = false;
    if (manifestSource.thumbnail.blob) {
      // there is a thumbnail that can be used
      url = URL.createObjectURL(manifestSource.thumbnail.blob);
    }
    else if (manifestSource.blob && manifestSource.blob.type.search('image/')) {
      // we have a blob or the source and it is of an image type so it can be used
      url = URL.createObjectURL(manifestSource.blob);
    }
    if (url) {
      // there is a thumbnail
      thumbnailMarkup = `<img src="${url}" title="${thumbnailTitle}"/>`;
    }
    let issuer = manifestSummary.manifestStore.signature.issuer;
    let signDate = new Date(manifestSummary.manifestStore.signature.isoDateString);
    let signDateString = signDate.toLocaleDateString() + ' ' +  signDate.toLocaleTimeString();
    let dateTitle = Drupal.t('Manifest signature date');
    let issuerTitle = Drupal.t('signing certificate subjet organization name');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Attribution and history data attached to this content'));
    let html = `
<section class="signature-information">
    <h4>${ccTitle}${infoIcon}</h4>
    <div class="thumbnail">${thumbnailMarkup}</div>
    <dt class="cert-issuer"><span class="cert-issuer" aria-label="${issuerTitle}" title="${issuerTitle}">${issuer}</span></dt>
    <dd class="signature-date"><span class="signature-date" aria-label="${dateTitle}" title="${dateTitle}">${signDateString}</span></dd>
</section>
`;
    return html;
  }
})(jQuery, Drupal, once, drupalSettings);
