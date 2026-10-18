import { z } from 'zod';
import type { BiomePresetId, SoundscapePresetId, WorldProfile } from '@/types/world';
import { BIOME_PRESETS } from '@/presets/biomePresets';

export const BiomePresetIdSchema = z.enum([
  'SUNLIT_GLADE',
  'GOLDEN_MEADOW',
  'MISTY_ZEN_STREAM',
  'TWILIGHT_GROVE'
]);

export const SoundscapePresetIdSchema = z.enum([
  'MORNING_BREEZE',
  'AMBER_STILLNESS',
  'JADE_RAIN_STREAM',
  'TWILIGHT_CRICKETS'
]);

export const WorldProfileSchema = z.object({
  biomeId: BiomePresetIdSchema.catch('SUNLIT_GLADE'),
  soundscapeId: SoundscapePresetIdSchema.catch('MORNING_BREEZE'),
  narrativeLine: z
    .string()
    .trim()
    .min(5)
    .max(220)
    .catch(
      'Calm light settles across your sanctuary. Follow the illuminated stepping-stone path to your first destination.'
    ),
  atmosphereNote: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .catch('Balanced daylight atmosphere • Deterministic route active'),
  sunElevationDeg: z
    .number()
    .finite()
    .transform((n) => Math.min(75, Math.max(12, Math.round(n))))
    .catch(45),
  fogDensity: z
    .number()
    .finite()
    .transform((n) => Number(Math.min(0.035, Math.max(0.006, n)).toFixed(3)))
    .catch(0.012)
});

/**
 * Coerces arbitrary or partially malformed LLM profile tokens into a strictly
 * validated WorldProfile with consistent biome/soundscape defaults.
 */
export function coerceValidWorldProfile(
  rawProfile: unknown,
  fallbackBiomeId: BiomePresetId = 'SUNLIT_GLADE'
): WorldProfile {
  const defaultBiome = BIOME_PRESETS[fallbackBiomeId];
  const parsed = WorldProfileSchema.safeParse(rawProfile ?? {});

  if (!parsed.success) {
    return {
      biomeId: fallbackBiomeId,
      soundscapeId: defaultBiome.defaultSoundscape,
      narrativeLine: defaultBiome.tagline,
      atmosphereNote: `${defaultBiome.name} preset active`,
      sunElevationDeg: fallbackBiomeId === 'MISTY_ZEN_STREAM' ? 28 : 48,
      fogDensity: fallbackBiomeId === 'MISTY_ZEN_STREAM' ? 0.018 : 0.012
    };
  }

  return parsed.data;
}
