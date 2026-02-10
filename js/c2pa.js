import {
  createC2pa
} from "https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.5.5/+esm";
const wasmSrc = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.5.5/dist/resources/c2pa_bg.wasm';

const c2pa = await createC2pa({ wasmSrc });


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

  Drupal.c2pa.menu = Drupal.c2pa.menu || document.createElement('ul');
  Drupal.c2pa.menu.classList.add('c2pa-menu');
  Drupal.c2pa.menuState = Drupal.c2pa.menuState || 0;
  Drupal.c2pa.c2paWorker = c2pa;

  /**
   * takes the source for a media asset and returns a URL for the content authenticity verification website
   *
   * @param src
   * @returns {string}
   */
  Drupal.c2pa.generateVerifyUrl = function(src) {
    const verifyUrl = `https://contentauthenticity.adobe.com/inspect?source=${src}`;
    return verifyUrl;
  }

  /**
   * Maps C2PA v2 action identifiers to USWDS icon SVG paths.
   *
   * Icons should live in: assets/svg/actions/
   * Fallback icon: help.svg
   */
  Drupal.c2pa.actionMap = {
      'c2pa.addedText': 'text_fields.svg',
      'c2pa.adjustedColor': 'settings.svg',
      'c2pa.changedSpeed': 'timer.svg',

      // Deprecated but included
      'c2pa.color_adjustments': 'settings.svg',

      'c2pa.converted': 'update.svg',
      'c2pa.created': 'add_circle.svg',

      // No direct USWDS equivalent
      'c2pa.cropped': null,

      'c2pa.deleted': 'delete.svg',
      'c2pa.drawing': 'edit.svg',
      'c2pa.dubbed': 'hearing.svg',

      'c2pa.edited': 'edit.svg',
      'c2pa.edited.metadata': 'settings.svg',

      'c2pa.enhanced': 'star.svg',
      'c2pa.filtered': 'filter_alt.svg',
      'c2pa.mastered': 'verified.svg',

      'c2pa.mixed': null,

      'c2pa.opened': 'folder_open.svg',

      'c2pa.orientation': null,

      'c2pa.placed': 'add.svg',
      'c2pa.published': 'public.svg',

      'c2pa.redacted': 'visibility_off.svg',

      'c2pa.remixed': null,
      'c2pa.removed': 'remove.svg',

      'c2pa.repackaged': 'update.svg',

      'c2pa.resized': 'unfold_more.svg',
      'c2pa.resized.proportional': 'unfold_more.svg',

      'c2pa.transcoded': 'update.svg',
      'c2pa.translated': 'translate.svg',
      'c2pa.trimmed': 'unfold_less.svg',

      'c2pa.unknown': 'help.svg',

      'c2pa.watermarked': 'verified_user.svg',
      'c2pa.watermarked.bound': 'verified_user.svg',
      'c2pa.watermarked.unbound': 'verified_user.svg',
    };

  /**
   * Get the icon path for a C2PA action.
   *
   * @param {string} action
   * @returns {string}
   */
   Drupal.c2pa.getC2paActionIcon = function(action) {
    const icon = Drupal.c2pa.actionMap[action];
    return drupalSettings.path.baseUrl + drupalSettings.c2pa.modulePath + `/assets/svg/actions/${icon || 'help.svg'}`;
  }

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

  /**
   * show the menu
   *
   * @param menu
   */
  Drupal.c2pa.toggleMenuOn = function(menu) {
    if (Drupal.c2pa.menuState !== 1) {
      Drupal.c2pa.menuState = 1;
      menu.classList.add('contextMenuActive');
    }
  }

  /**
   * hide the menu
   *
   * @param menu
   */
  Drupal.c2pa.toggleMenuOff = function(menu) {
    if (Drupal.c2pa.menuState !== 0) {
      Drupal.c2pa.menuState  = 0;
      menu.classList.remove('contextMenuActive');
    }
  }

  /**
   * get the position of the right click
   *
   * @param e
   * @returns {{x: (boolean|number|*), y: (boolean|number|*)}}
   */
  Drupal.c2pa.getPosition = function(e) {

    let coordinates = {
      x: e.offsetX,
      y: e.offsetY,
    };
    return coordinates;
  }

  /**
   * position the menu where the click occured
   *
   * @param e
   * @param menu
   */
  Drupal.c2pa.positionMenu = function(e, menu) {
    let clickCoords = Drupal.c2pa.getPosition(e);
    let clickCoordsX = clickCoords.x;
    let clickCoordsY = clickCoords.y;

    let menuWidth = menu.offsetWidth + 4;
    let menuHeight = menu.offsetHeight + 4;

    let windowWidth = window.innerWidth;
    let windowHeight = window.innerHeight;

    if (windowWidth - clickCoordsX < menuWidth) {
      menu.style.left = windowWidth - menuWidth + "px";
    } else {
      menu.style.left = clickCoordsX + "px";
    }

    if (windowHeight - clickCoordsY < menuHeight) {
      menu.style.top = windowHeight - menuHeight + "px";
    } else {
      menu.style.top = clickCoordsY + "px";
    }
  }

  Drupal.c2pa.resourceToUrl = async function(thumbnail, reader) {
    const bytes = await reader.resourceToBytes(thumbnail.identifier);console.log('bytes', bytes);
    // thumbRef.format is usually like "image/jpeg" or "image/png"
    const thumbBlob = new Blob([bytes], { type: thumbnail.format || 'image/jpeg' });console.log('thumbBlob', thumbBlob);
    let url = URL.createObjectURL(thumbBlob);console.log('url', url);
    return url;
  }

  $(document).ready(function() {

    // set up listeners to dismiss the context menu
    $(document).click(function(e) {
      // left mouse button was pressed
      var button = e.which || e.button;
      if ( button === 1 ) {
        $('ul.context-menu').each(function() {
          Drupal.c2pa.toggleMenuOff(this);
        });
      }
      if ( e.keyCode === 27 ) {
        // escape key was pressed
        $('ul.context-menu').each(function() {
          Drupal.c2pa.toggleMenuOff(this);
        });
      }
    });

    Drupal.attachBehaviors();

  });

  Drupal.behaviors.c2pa = {
    attach(context, settings) {
      once("init-c2pa", ".c2pa-wrapper", context).forEach(  (wrapper) => {

        wrapper.querySelectorAll("img, video, audio, picture").forEach(async (element) => {
          let src = Drupal.c2pa.elementSrc(element);
          let original = Drupal.c2pa.elementOriginal(element);
          if ( original ) {
            src = original;
          }
          const response = await fetch(src);
          const blob = await response.blob();
          const reader = await c2pa.reader.fromBlob(blob.type, blob);
          let jsonManifest = await reader.json();
          let manifestStore = await reader.manifestStore();
          if (manifestStore === null) {
            // if there is no manifests, skip it
            return;
          }
          const manifestStoreResult = manifestStore;
          /*const manifestStoreResult = await createL2ManifestStore(
            result.manifestStore
          );*/
          if (typeof manifestStore.activeManifest === 'undefined') {
            manifestStoreResult.activeManifest = manifestStore.manifests[manifestStore.active_manifest];
          }
          const id = await Drupal.c2pa.idFromElement(element);

          // get the rendered manifest
          let manifestMarkup = await Drupal.theme('c2paManifestSummary', manifestStoreResult, src, manifestStore.activeManifest , reader);
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

      once('init-download-original-menu-creation', '.c2pa-wrapper img[data-original]', context).forEach(async (image) => {
        let original = $(image).data('original');

        // add the menu (hidden) to the image
        const contextmenu = document.createElement('ul');
        contextmenu.classList.add('context-menu');
        const button = document.createElement('a');
        button.classList.add('originalButton');
        button.textContent = Drupal.t('Download Original Image');
        button.setAttribute('href', original);
        button.setAttribute('download', '');
        button.classList.add('button');
        const li = document.createElement('li');
        li.append(button);
        contextmenu.append(li);
        $(image).parent().append(contextmenu);

        // add the contextmenu event listener
        $(image).contextmenu(function(event) {

          let menu = $(image).siblings('ul.context-menu')[0];
          event.preventDefault();
          Drupal.c2pa.toggleMenuOn(menu);
          Drupal.c2pa.positionMenu(event, menu);
          // create the menu
          // show the menu at the location of the cursor
        });

        // attach behaviors
        Drupal.attachBehaviors(context);
      });

      once('init-download-original-button-click', 'ul.context-menu button.originalButton', context).forEach(async (button) => {
        let original = $(button).data('original');
        if (original !== '') {

        }
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

  Drupal.c2pa.elementOriginal = function(element) {
    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
      case 'img':
        const original = $(element).data('original');
        if (original) {
          return original
        }
        return false;
        break;
      case 'video':
      case 'audio':
        return false;
        break;
    }
    return false;
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
    var margin = this.margin();
    var padding = this.padding();
    var border = this.border();
    return {
      left: margin.left + padding.left + border.left,
      top: margin.top + padding.top + border.top
    }
  };

  $.fn.fixedPosition = function () {
    /// <summary>Returns the "fixed" position of the element; i.e., the position relative to the browser window.</summary>
    /// <returns type="Object">Object with 'x' and 'y' properties.</returns>
    var offset = this.offset();
    var $doc = $(document);
    var bodyOffset = $(document.body).outerOffset();
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
  Drupal.theme.c2paManifestSummary = async function(manifestSummary, srcUrl, manifestSource, reader) {
    const assertions = manifestSummary.activeManifest.assertions;
    let c2paSignatureInformation = (drupalSettings.c2pa.content_credentials ?? true) ? await Drupal.theme('c2paSignatureInformation', manifestSummary, manifestSource, reader) : '';
    let claimGenerator = (drupalSettings.c2pa?.produced_with ?? true) ? await Drupal.theme('c2paClaimGenerator', manifestSummary) : '';
    let verifyUrl = (drupalSettings.c2pa?.view_more ?? true) ? await Drupal.theme('c2paVerifyUrl', manifestSummary, srcUrl) : '';
    const actionsAssertion = assertions.find(a => a.label === 'c2pa.actions.v2');
    let editsAndActivity = (drupalSettings.c2pa?.edits_and_activities ?? true) ? await Drupal.theme('c2paEditsAndActivity', actionsAssertion) : '';
    let assetsUsed = (drupalSettings.c2pa?.assets_used ?? true) ? await Drupal.theme('c2paAssetsUsed', manifestSummary?.manifestStore?.ingredients ?? manifestSummary?.activeManifest?.ingredients, manifestSource, reader) : '';
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
  Drupal.theme.c2paAssetsUsed = async function(ingredients, manifestSource, reader) {
    if (typeof ingredients == 'undefined') {
      // apparently there were no assets used to make this asset
      return '';
    }
    let title = Drupal.t('Assets used');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Any assets used or added to this content'));

    let items = [];
    //await ingredients.forEach(async (thisIngredient) => {
    for (const thisIngredient of ingredients) {
      let ingredientTitle = Drupal.t('A thumbnail of a file used as an ingredient to make this media asset: @fileName.', {'@fileName': thisIngredient.title});
      if (thisIngredient.hasManifest) {
        ingredientTitle += ' ' + Drupal.t('A Content Credentials logo (the letters CR in a speech bubble) hovers over this image signifying that this ingredient contains a manifest.');
      }
      let ingredientClass = thisIngredient.hasManifest ? 'has-manifest' : 'no-manifest';
      let emptyText = Drupal.t('This ingredient contains no thumbnail.');
      let thisIngredientMarkup = `<a title="${ingredientTitle} ${emptyText}" class="image-thumb empty" href="#"><span class="hidden">${emptyText}</span><a/>`;

      let thumbnailUrl = false;
      if (thisIngredient.thumbnail) {
       let thumbnail = thisIngredient.thumbnail;console.log(588);
      }

      if (thisIngredient.thumbnail) {
        let thumbUrl = await Drupal.c2pa.resourceToUrl(thisIngredient.thumbnail, reader);
        thisIngredientMarkup = `<img alt="${ingredientTitle}" src="${thumbUrl}"/>`;
      }

      items.push(`<li class="${ingredientClass}" data-format="${thisIngredient.format}" data-has-manifest="${thisIngredient.hasManifest}">${thisIngredientMarkup}</li>`);
    }
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
  Drupal.theme.c2paEditsAndActivity = async function(actionsAssertion) {
    let title = Drupal.t('Edits and Activity');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Changes and actions taken to produce this content'));
    let edits = [];
    actionsAssertion.data.actions.forEach((thisEdit) => {
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
    let label = Drupal.t(edit.action);
    let description = Drupal.t(edit.description ?? '') ;
    let iconTitle = Drupal.t('Icon for @label', {'@label': edit.action});
    let iconTemp = Drupal.c2pa.getC2paActionIcon(edit.action);
    let icon = edit.icon ?? `<img class="icon" src="${iconTemp}" alt="${iconTitle}"/>`;
    return `
<dt class="label" data-edit-id="${edit.action}">${icon}<span class="section-edits-and-activity-list-item-label">${label}</span></dt>
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
    const url = Drupal.c2pa.generateVerifyUrl(src);
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
    const claimGeneratorInfo = manifestSummary.activeManifest.claim_generator_info;
    const claimGeneratorName = claimGeneratorInfo[0].name;
    const claimGeneratorVersion = claimGeneratorInfo[0].version;
    const claimGeneratorOS = claimGeneratorInfo[0].operating_system;
    let claimGenerator = `${claimGeneratorName} ${claimGeneratorVersion} ${claimGeneratorOS}`;
    let title = Drupal.t('Produced With');
    let infoIcon = await Drupal.theme('c2paInfoItem', Drupal.t('Software used to make this content'));
    let claimTitle = Drupal.t('Software that generated the manifest and claim.');
    return `
<section class="produced-by">
  <h4>${title}${infoIcon}</h4>

  <span class="claim-generator" aria-label="${claimTitle}" title="${claimTitle}">${claimGenerator}</span>
</section>`
  }

  Drupal.c2pa.ThumbnailDataUrl = async function(ingredient) {
    if (ingredient.thumbnail) {
      const thumbnailBlob = new Blob([ingredient.thumbnail], { type: ingredient.thumbnail.format ?? 'image/jpeg' }); // Adjust type if needed

      // 4. Convert to Data URL
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onloadend = () => resolve(fileReader.result);
        fileReader.onerror = reject;
        fileReader.readAsDataURL(thumbnailBlob);
      });
    }
    else {
      return null;
    }
  }

  /**
   * display information about the signature
   *
   * @param manifestSummary
   * @returns {Promise<string>}
   */
  Drupal.theme.c2paSignatureInformation = async function(manifestSummary, manifestSource, reader) {

    let ccTitle = Drupal.t("Content Credentials");
    let thumbnailTitle = Drupal.t('');
    let thumbnailMarkup = `<a href="#">${thumbnailTitle}</a>`;
    console.log(719, 'manifestSource', manifestSource);
    let url = false;
    if (manifestSource.thumbnail.blob) {
      // there is a thumbnail that can be used
      url = URL.createObjectURL(manifestSource.thumbnail.blob);console.log(723, 'url', url);
    }
    else if (manifestSource.blob && manifestSource.blob.type.search('image/')) {
      // we have a blob or the source and it is of an image type so it can be used
      url = URL.createObjectURL(manifestSource.blob);console.log(727, 'url', url);
    }
    else if (manifestSource.thumbnail.identifier) {
      url = await Drupal.c2pa.resourceToUrl(manifestSource.thumbnail, reader);console.log(730, 'url', url);
    }
    console.log(732, 'url', url);
    if (url) {
      // there is a thumbnail
      thumbnailMarkup = `<img src="${url}" title="${thumbnailTitle}"/>`;
    }
    const signatureInfo = manifestSummary.activeManifest.signature_info;
    let issuer = signatureInfo.issuer;
    let signDate = new Date(signatureInfo.time);
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
