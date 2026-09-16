import { describe, it, expect } from 'vitest';
import { detectHardwareCapabilities } from '../src/utils/hardwareDetector';
import { WindowsAudioCaptureAdapter } from '../src/services/native/WindowsAudioCapture';

describe('Hardware Capability Detector', () => {
  it('recommends whisper tiny, base, or small appropriately based on hardware parameters', () => {
    const profile = detectHardwareCapabilities();
    expect(['tiny', 'base', 'small']).toContain(profile.recommendedModel);
    expect(profile.cpuCores).toBeGreaterThan(0);
    expect(profile.description).toBeTruthy();
  });
});

describe('Windows Native Audio Capture Adapter Skeleton & Fallback', () => {
  it('detects browser fallback mode when running outside Electron desktop shell', async () => {
    const adapter = new WindowsAudioCaptureAdapter();
    const status = await adapter.checkStatus();

    expect(status.mode).toBe('browser-fallback');
    expect(status.details).toContain('Browser mode active');
  });

  it('provides audio devices including default render (loopback) and capture (mic)', async () => {
    const adapter = new WindowsAudioCaptureAdapter();
    const devices = await adapter.getAudioDevices();

    expect(devices.length).toBeGreaterThan(0);
    const renderDev = devices.find((d) => d.type === 'render');
    const captureDev = devices.find((d) => d.type === 'capture');

    expect(renderDev).toBeDefined();
    expect(captureDev).toBeDefined();
  });
});
