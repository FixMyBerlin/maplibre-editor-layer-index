import { z } from 'zod'

/**
 * Zod schema for an Editor Layer Index feature, matching the published
 * `imagery.geojson`. Intentionally permissive on fields we don't consume
 * (`.passthrough` via `.loose()`), but strict on the shape we rely on — if the
 * upstream structure drifts, validation fails and we refuse to publish.
 *
 * @see https://github.com/osmlab/editor-layer-index/blob/master/schema.json
 */

export const eliAttributionSchema = z
  .object({
    text: z.string().optional(),
    url: z.string().optional(),
    html: z.string().optional(),
    required: z.boolean().optional(),
  })
  .loose()

export const eliPropertiesSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['tms', 'wms', 'wmts', 'bing', 'scanex', 'wms_endpoint', 'pmtiles']),
    url: z.string(),
    category: z
      .enum([
        'photo',
        'map',
        'historicmap',
        'osmbasedmap',
        'historicphoto',
        'qa',
        'elevation',
        'other',
      ])
      .optional(),
    min_zoom: z.number().int().min(0).optional(),
    max_zoom: z.number().int().min(1).optional(),
    tile_size: z.number().int().optional(),
    attribution: eliAttributionSchema.optional(),
    license_url: z.string().optional(),
    country_code: z.string().optional(),
    available_projections: z.array(z.string()).optional(),
    overlay: z.boolean().optional(),
    best: z.boolean().optional(),
    icon: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .loose()

export const eliGeometrySchema = z
  .object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.any()),
  })
  .loose()

export const eliFeatureSchema = z
  .object({
    type: z.literal('Feature'),
    properties: eliPropertiesSchema,
    // `null` geometry means worldwide coverage.
    geometry: eliGeometrySchema.nullable(),
  })
  .loose()

export const eliFeatureCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(eliFeatureSchema),
  })
  .loose()

export type EliFeature = z.infer<typeof eliFeatureSchema>
export type EliProperties = z.infer<typeof eliPropertiesSchema>
export type EliFeatureCollection = z.infer<typeof eliFeatureCollectionSchema>
