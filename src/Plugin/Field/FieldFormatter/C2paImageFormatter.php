<?php

namespace Drupal\c2pa\Plugin\Field\FieldFormatter;

use Drupal\Core\Url;
use Drupal\file\Entity\File;
use Drupal\image\Plugin\Field\FieldFormatter\ImageFormatter;
use Drupal\Core\Field\FieldItemListInterface;

/**
 * Plugin implementation of the 'c2pa_image' formatter.
 *
 * @FieldFormatter(
 *   id = "c2pa_image_formatter",
 *   label = @Translation("C2PA image formatter"),
 *   field_types = {
 *     "image"
 *   }
 * )
 */
class C2paImageFormatter extends ImageFormatter {

  /**
   * {@inheritdoc}
   */
  public function settingsSummary() {
    $summary = parent::settingsSummary();
    $summary[] = $this->t('Formats the image for use with the c2pa module');
    return $summary;
  }

  /**
   * {@inheritdoc}
   */
  public function viewElements(FieldItemListInterface $items, $langcode) {
    $elements = parent::viewElements($items, $langcode);

    foreach ($elements as &$element) {
      $item = $element['#item'];
      $fid = $item->getValue()['target_id'];
      $file = File::load($fid);
      $uri = $file->getFileUri();
      $original_url = $this->fileUrlGenerator->generateAbsoluteString($uri);
      if (!empty($original_url)) {
        $element['#item_attributes']['data-original'] = $original_url;
      }
      // wrap the element in a container with the appropriate class
      $element = [
        '#type' => 'container',
        '#attributes' => [
          'class' => ['image', 'c2pa-wrapper'],
        ],
        'image' => $element,
      ];
      // the library doesn't need to be on every page load, just those with
      // images and a wrapping container with the c2pa-wrapper class
      c2pa_add_attachments($element);
    }

    return $elements;
  }

}
