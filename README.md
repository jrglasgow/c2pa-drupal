# c2pa-drupal
Drupal module enabling the processing &amp; display of c2pa data for supported images

This module is a work in progress. It is not currently available via composer, etc.

Currently, there are two parts to this module:

**c2pa_image_formatter:** 
This is an image field formatter that provides the necessary html/CSS to overlay our web components on the images. It wraps images in a div marked with the “c2pa-wrapper” class, which is used both to apply positioning rules and for the script to locate images the script should attempt to process.

**c2pa.js:**
This script will pull in the necessary dependencies from the jsdelivr CDN (two of them – our core SDK for processing and the web components for UI) and then search for images wrapped with a “c2pa-wrapper” div. Upon finding one it will run the image through our SDK, extract the C2PA data, and then append the web component elements to the DOM with the correct properties set. 
