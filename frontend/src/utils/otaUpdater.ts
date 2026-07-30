import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';

/**
 * Initializes automatic Over-The-Air (OTA) update handling for the Android native app.
 * - Confirms app readiness on startup so Capgo locks in healthy updates (preventing rollbacks).
 * - Logs and checks current bundle state on app start and resume from background.
 * - Auto-updates are managed natively by Capgo plugin based on capacitor.config.ts settings.
 */
export async function initOtaUpdates(): Promise<void> {
  // OTA updates are only relevant when running natively inside Capacitor container
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // 1. Notify Capgo that current app version initialized successfully (critical health check)
    await CapacitorUpdater.notifyAppReady();

    // 2. Function to inspect active bundle version
    const checkForUpdates = async () => {
      try {
        const currentInfo = await CapacitorUpdater.current();
        if (currentInfo && currentInfo.bundle) {
          console.log(`[OTA] Active bundle ID: ${currentInfo.bundle.id}, Native version: ${currentInfo.native}`);
        }
      } catch (err) {
        console.warn('[OTA] Check current bundle error (silent):', err);
      }
    };

    // 3. Check current bundle status on initial app launch
    checkForUpdates();

    // 4. Re-check whenever app resumes from background
    App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        checkForUpdates();
      }
    });

  } catch (error) {
    console.error('[OTA] Failed to initialize Capacitor OTA updater:', error);
  }
}
