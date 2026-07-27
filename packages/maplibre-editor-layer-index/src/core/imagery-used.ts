import type { EliLayer } from './types'

/** Redact sensitive URL template parts the way iD does for custom backgrounds. */
export function sanitizeImageryUrlTemplate(template: string): string {
  return template
    .replace(/access_token=[^&]+/gi, 'access_token={apikey}')
    .replace(/connectId=[^&]+/gi, 'connectId={apikey}')
    .replace(/([?&;])token=[^&]+/gi, '$1token={apikey}')
    .replace(/Signature=[^&]+/gi, 'Signature={apikey}')
    .replace(/\/token\/[^/]+\//g, '/token/{apikey}/')
    .replace(/key=[^&;/]+/gi, 'key={apikey}')
}

/**
 * iD-compatible `imagery_used` value for an ELI layer.
 * Indexed sources use the display name; custom backgrounds append a sanitized template.
 */
export function getImageryUsedValue(layer: Pick<EliLayer, 'name' | 'urlTemplate' | 'id'>): string {
  const name = layer.name.trim()

  // Indexed ELI sources: name only (same as iD's background_source.imageryUsed).
  if (layer.id !== 'custom') {
    return name || layer.id
  }

  const template = layer.urlTemplate.trim()
  if (!template) return name || 'Custom'

  const sanitized = sanitizeImageryUrlTemplate(template)
  if (!name) return sanitized
  return `${name} (${sanitized})`
}
