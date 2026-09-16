/**
 * Client Hardware Capability Detector
 * Recommends optimal local Whisper model (tiny, base, small) based on CPU cores, RAM, and GPU.
 */

export interface HardwareProfile {
  cpuCores: number;
  ramGb: number;
  gpuRenderer?: string;
  hasDedicatedGpu: boolean;
  recommendedModel: 'tiny' | 'base' | 'small';
  description: string;
}

export function detectHardwareCapabilities(): HardwareProfile {
  const cpuCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const ramGb = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 8 : 8;

  let gpuRenderer = 'Standard Integrated Graphics';
  let hasDedicatedGpu = false;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
          if (/nvidia|geforce|rtx|gtx|radeon/i.test(gpuRenderer)) {
            hasDedicatedGpu = true;
          }
        }
      }
    } catch (e) {
      // Ignore canvas/webgl errors
    }
  }

  let recommendedModel: 'tiny' | 'base' | 'small' = 'base';
  let description = '';

  if (cpuCores <= 4 && ramGb <= 4 && !hasDedicatedGpu) {
    recommendedModel = 'tiny';
    description = 'Low-end machine / Bronze laptop: Whisper Tiny recommended (Fastest, lowest CPU & RAM footprint).';
  } else if (hasDedicatedGpu || (cpuCores >= 8 && ramGb >= 16)) {
    recommendedModel = 'small';
    description = 'High-end machine with strong CPU/GPU: Whisper Small recommended (High accuracy & punctuation).';
  } else {
    recommendedModel = 'base';
    description = 'Standard Windows laptop: Whisper Base recommended (Optimal balance of speed & transcription quality).';
  }

  return {
    cpuCores,
    ramGb,
    gpuRenderer,
    hasDedicatedGpu,
    recommendedModel,
    description,
  };
}
