<?php

declare(strict_types=1);

namespace Drupal\c2pa\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Configure c2pa settings for this site.
 */
final class SettingsForm extends ConfigFormBase {

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'c2pa_settings';
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames(): array {
    return ['c2pa.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    $config = $this->config('c2pa.settings');
    $form['content_credentials'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Content Credentials'),
      '#description' => $this->t('Show the "Content Credentials" section. This is information about the Certificate used to Sign the Manifest.'),
      '#default_value' => $config->get('content_credentials'),
    ];
    $form['produced_with'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Produced With'),
      '#description' => $this->t('Show the "Produced With" section. This will be the "Claim Generator" of the software which appended and signed the manifest.'),
      '#default_value' => $config->get('produced_with'),
    ];
    $form['edits_and_activities'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Edits and Activities'),
      '#description' => $this->t('Show the "Edits and Activities" section. This includes a list of changes made to the asset made which the manifest is attesting to.'),
      '#default_value' => $config->get('edits_and_activities'),
    ];
    $form['assets_used'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Assets Used'),
      '#description' => $this->t('Show the "Assets Used" section. This is usually a thumbnail of the parent item or ingredient.'),
      '#default_value' => $config->get('assets_used'),
    ];
    $form['view_more'] = [
      '#title' => $this->t('View More'),
      '#description' => $this->t('Show the "View More" link.'),
      '#type' => 'checkbox',
      '#default_value' => $config->get('view_more'),
    ];
    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state): void {
    // @todo Validate the form here.
    // Example:
    // @code
    //   if ($form_state->getValue('example') === 'wrong') {
    //     $form_state->setErrorByName(
    //       'message',
    //       $this->t('The value is not correct.'),
    //     );
    //   }
    // @endcode
    parent::validateForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    // load the config
    $config = $this->config('c2pa.settings');
    // remove extraneous form values
    $form_state->cleanValues();
    // set all form values
    foreach ($form_state->getValues() as $key => $value) {
      $config->set($key, $value);
    }
    // save the config
    $config->save();
    parent::submitForm($form, $form_state);
  }

}
