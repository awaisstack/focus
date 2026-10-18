import type { BiomePresetId, SoundscapePresetId } from '@/types/world';

export interface BiomeDesignTokens {
  id: BiomePresetId;
  name: string;
  tagline: string;
  defaultSoundscape: SoundscapePresetId;
  cssVars: {
    bgPrimary: string;
    bgSurface: string;
    bgElevated: string;
    textPrimary: string;
    textMuted: string;
    accentPrimary: string;
    accentSoft: string;
    borderSubtle: string;
  };
  threeColors: {
    skyTop: string;
    skyHorizon: string;
    fogColor: string;
    sunColor: string;
    ambientColor: string;
    islandShore: string;
    islandMidMoss: string;
    islandHighPlateau: string;
    waterShallow: string;
    waterDeep: string;
    foliagePrimary: string;
    foliageSecondary: string;
    blossomAccent: string;
    stoneColor: string;
    activePathGlow: string;
    deferredMistTint: string;
  };
  lighting: {
    sunPosition: [number, number, number];
    sunIntensity: number;
    ambientIntensity: number;
    fogNear: number;
    fogFar: number;
  };
}

export const BIOME_PRESETS: Record<BiomePresetId, BiomeDesignTokens> = {
  SUNLIT_GLADE: {
    id: 'SUNLIT_GLADE',
    name: 'Sunlit Moss Glade',
    tagline: 'Warm morning clarity with dappled pine light and gentle brook water.',
    defaultSoundscape: 'MORNING_BREEZE',
    cssVars: {
      bgPrimary: '#0E1C14',
      bgSurface: 'rgba(19, 36, 27, 0.94)',
      bgElevated: 'rgba(29, 54, 40, 0.96)',
      textPrimary: '#F7F4EB',
      textMuted: '#B8C9BE',
      accentPrimary: '#E8B84B',
      accentSoft: 'rgba(232, 184, 75, 0.18)',
      borderSubtle: 'rgba(184, 201, 190, 0.22)'
    },
    threeColors: {
      skyTop: '#A9D6CD',
      skyHorizon: '#EBF4E6',
      fogColor: '#D6EAE1',
      sunColor: '#FFF3D1',
      ambientColor: '#C8E6DC',
      islandShore: '#8C7A5B',
      islandMidMoss: '#467D53',
      islandHighPlateau: '#5B9662',
      waterShallow: '#58A4B0',
      waterDeep: '#336B78',
      foliagePrimary: '#2E5E3E',
      foliageSecondary: '#4E8752',
      blossomAccent: '#F4C95D',
      stoneColor: '#9BA8A1',
      activePathGlow: '#F6C653',
      deferredMistTint: '#7A9188'
    },
    lighting: {
      sunPosition: [18, 26, 14],
      sunIntensity: 1.55,
      ambientIntensity: 0.85,
      fogNear: 28,
      fogFar: 68
    }
  },
  GOLDEN_MEADOW: {
    id: 'GOLDEN_MEADOW',
    name: 'Amber Meadow',
    tagline: 'Late-afternoon honeyed light across warm upland grasses.',
    defaultSoundscape: 'AMBER_STILLNESS',
    cssVars: {
      bgPrimary: '#1A160E',
      bgSurface: 'rgba(33, 29, 20, 0.94)',
      bgElevated: 'rgba(48, 41, 28, 0.96)',
      textPrimary: '#FBF6EC',
      textMuted: '#D1C4AC',
      accentPrimary: '#F29F3D',
      accentSoft: 'rgba(242, 159, 61, 0.20)',
      borderSubtle: 'rgba(209, 196, 172, 0.22)'
    },
    threeColors: {
      skyTop: '#D9A76A',
      skyHorizon: '#F9E5C2',
      fogColor: '#EED9B7',
      sunColor: '#FFD99B',
      ambientColor: '#F3DEC0',
      islandShore: '#8F704D',
      islandMidMoss: '#7C863F',
      islandHighPlateau: '#9DA34C',
      waterShallow: '#4E8294',
      waterDeep: '#2C5566',
      foliagePrimary: '#52612E',
      foliageSecondary: '#86903E',
      blossomAccent: '#FF9F45',
      stoneColor: '#A69D91',
      activePathGlow: '#FFAE42',
      deferredMistTint: '#8C857B'
    },
    lighting: {
      sunPosition: [22, 18, 10],
      sunIntensity: 1.65,
      ambientIntensity: 0.8,
      fogNear: 26,
      fogFar: 65
    }
  },
  MISTY_ZEN_STREAM: {
    id: 'MISTY_ZEN_STREAM',
    name: 'Misty Zen Stream',
    tagline: 'Grounded jade stillness designed for calm recalibration when plans change.',
    defaultSoundscape: 'JADE_RAIN_STREAM',
    cssVars: {
      bgPrimary: '#0E191C',
      bgSurface: 'rgba(20, 32, 36, 0.94)',
      bgElevated: 'rgba(29, 46, 52, 0.96)',
      textPrimary: '#F1F7F6',
      textMuted: '#ADC4C2',
      accentPrimary: '#64C4A4',
      accentSoft: 'rgba(100, 196, 164, 0.18)',
      borderSubtle: 'rgba(173, 196, 194, 0.22)'
    },
    threeColors: {
      skyTop: '#7BA3A8',
      skyHorizon: '#CBE0DF',
      fogColor: '#BBD4D3',
      sunColor: '#E6F5F2',
      ambientColor: '#B5D6D4',
      islandShore: '#6E7571',
      islandMidMoss: '#3E6B60',
      islandHighPlateau: '#528275',
      waterShallow: '#488894',
      waterDeep: '#244E59',
      foliagePrimary: '#284D45',
      foliageSecondary: '#3F7065',
      blossomAccent: '#72DFC0',
      stoneColor: '#8B9B99',
      activePathGlow: '#6EE7C2',
      deferredMistTint: '#687E7D'
    },
    lighting: {
      sunPosition: [12, 22, 16],
      sunIntensity: 1.2,
      ambientIntensity: 0.95,
      fogNear: 22,
      fogFar: 58
    }
  },
  TWILIGHT_GROVE: {
    id: 'TWILIGHT_GROVE',
    name: 'Twilight Firefly Grove',
    tagline: 'Peaceful dusk sanctuary illuminated by stone lanterns and drifting fireflies.',
    defaultSoundscape: 'TWILIGHT_CRICKETS',
    cssVars: {
      bgPrimary: '#0C0F1D',
      bgSurface: 'rgba(19, 22, 38, 0.94)',
      bgElevated: 'rgba(29, 34, 56, 0.96)',
      textPrimary: '#F3F2F9',
      textMuted: '#B3B5CE',
      accentPrimary: '#F5C253',
      accentSoft: 'rgba(245, 194, 83, 0.18)',
      borderSubtle: 'rgba(179, 181, 206, 0.22)'
    },
    threeColors: {
      skyTop: '#1B223D',
      skyHorizon: '#3B3659',
      fogColor: '#262845',
      sunColor: '#C9D6FF',
      ambientColor: '#5B6794',
      islandShore: '#4A4E5E',
      islandMidMoss: '#284240',
      islandHighPlateau: '#345450',
      waterShallow: '#2E5370',
      waterDeep: '#182C42',
      foliagePrimary: '#1D3333',
      foliageSecondary: '#2B4C49',
      blossomAccent: '#F7C95F',
      stoneColor: '#697089',
      activePathGlow: '#FAD06C',
      deferredMistTint: '#484E69'
    },
    lighting: {
      sunPosition: [-14, 18, -12],
      sunIntensity: 0.95,
      ambientIntensity: 0.7,
      fogNear: 24,
      fogFar: 60
    }
  }
};

export const BIOME_PRESET_LIST: BiomeDesignTokens[] = Object.values(BIOME_PRESETS);
