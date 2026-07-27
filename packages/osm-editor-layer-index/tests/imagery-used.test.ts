import { describe, expect, it } from 'vitest'
import { getImageryUsedValue, sanitizeImageryUrlTemplate } from '../src/core/imagery-used'

describe('sanitizeImageryUrlTemplate', () => {
  it('redacts api tokens like iD', () => {
    expect(sanitizeImageryUrlTemplate('https://example.com?access_token=SECRET')).toBe(
      'https://example.com?access_token={apikey}',
    )
    expect(sanitizeImageryUrlTemplate('https://example.com?connectId=SECRET')).toBe(
      'https://example.com?connectId={apikey}',
    )
    expect(sanitizeImageryUrlTemplate('https://example.com?token=SECRET')).toBe(
      'https://example.com?token={apikey}',
    )
    expect(sanitizeImageryUrlTemplate('https://example.com/wms/v1/token/MYTOKEN/1.0.0/layer')).toBe(
      'https://example.com/wms/v1/token/{apikey}/1.0.0/layer',
    )
    expect(sanitizeImageryUrlTemplate('https://example.com/services;key=MYTOKEN/layer')).toBe(
      'https://example.com/services;key={apikey}/layer',
    )
  })
})

describe('getImageryUsedValue', () => {
  it('uses the ELI display name for indexed sources', () => {
    expect(
      getImageryUsedValue({
        id: 'GeoportalBerlin-DOP20RGBI2024',
        name: 'Geoportal Berlin / Digitale farbige Orthophotos 2024 (DOP20RGBI)',
        urlTemplate: 'https://tiles.codefor.de/berlin-2024-dop20rgbi/{z}/{x}/{y}.png',
      }),
    ).toBe('Geoportal Berlin / Digitale farbige Orthophotos 2024 (DOP20RGBI)')
  })

  it('appends a sanitized template for custom backgrounds', () => {
    expect(
      getImageryUsedValue({
        id: 'custom',
        name: 'Custom',
        urlTemplate: 'https://example.com?access_token=SECRET',
      }),
    ).toBe('Custom (https://example.com?access_token={apikey})')
  })

  it('falls back to the layer id when the indexed name is empty', () => {
    expect(
      getImageryUsedValue({
        id: 'SomeLayer',
        name: '  ',
        urlTemplate: 'https://example.com/{z}/{x}/{y}.png',
      }),
    ).toBe('SomeLayer')
  })
})
