/**
 * Capacitor Native Services
 * 
 * Handles:
 * 1. Push Notifications (FCM via Capacitor)
 * 2. Biometric Authentication (Fingerprint / Face ID)
 * 3. Native Preferences Storage (replaces localStorage)
 * 
 * These only work in native Android/iOS app (built via Capacitor).
 * In browser, fallback to web implementations.
 */

import { Capacitor } from '@capacitor/core';

// ─── Platform Detection ───────────────────────────────────────────────────────
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';
export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';

// ─── Native Preferences (Persistent Storage — survives app kills) ─────────────
let Preferences: any = null;

const getPreferences = async () => {
  if (!isNativeApp()) return null;
  if (Preferences) return Preferences;
  try {
    const mod = await import('@capacitor/preferences');
    Preferences = mod.Preferences;
    return Preferences;
  } catch (_) {
    return null;
  }
};

export const nativeStorage = {
  set: async (key: string, value: string): Promise<void> => {
    const prefs = await getPreferences();
    if (prefs) {
      await prefs.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },

  get: async (key: string): Promise<string | null> => {
    const prefs = await getPreferences();
    if (prefs) {
      const { value } = await prefs.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  remove: async (key: string): Promise<void> => {
    const prefs = await getPreferences();
    if (prefs) {
      await prefs.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },

  clear: async (): Promise<void> => {
    const prefs = await getPreferences();
    if (prefs) {
      await prefs.clear();
    } else {
      localStorage.clear();
    }
  },
};

// ─── Biometric Authentication ─────────────────────────────────────────────────
export interface BiometricResult {
  success: boolean;
  error?: string;
}

export const biometricAuth = {
  isAvailable: async (): Promise<boolean> => {
    if (!isNativeApp()) return false;
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable({ useFallback: true } as any);
      return result.isAvailable;
    } catch (_) {
      return false;
    }
  },

  /**
   * Perform biometric authentication
   */
  authenticate: async (reason: string = 'Verify your identity'): Promise<BiometricResult> => {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric not available in browser' };
    }
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Security Verification',
        subtitle: 'Log in to your account',
        description: reason,
        negativeButtonText: 'Cancel',
        usePin: true
      } as any);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Biometric authentication failed',
      };
    }
  },

  /**
   * Get the type of biometric available (fingerprint/face)
   */
  getBiometryType: async (): Promise<'fingerprint' | 'face' | 'none'> => {
    if (!isNativeApp()) return 'none';
    try {
      const { NativeBiometric, BiometryType } = await import('@capgo/capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) return 'none';
      
      const type = result.biometryType;
      if (type === BiometryType.FACE_ID || type === BiometryType.FACE_AUTHENTICATION) {
        return 'face';
      }
      if (type === BiometryType.TOUCH_ID || type === BiometryType.FINGERPRINT) {
        return 'fingerprint';
      }
      return 'fingerprint'; // default fallback for other active locks
    } catch (_) {
      return 'none';
    }
  },
};

const rawApiUrl = import.meta.env.VITE_API_URL as string || "";
const API_BASE = (rawApiUrl && !rawApiUrl.includes("onrender.com")) ? rawApiUrl : 'https://fieldops-secondary-api.sunilbishnoi.workers.dev';

const saveFCMToken = async (token: string): Promise<void> => {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !token) return;
    await fetch(`${API_BASE}/api/users/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fcm_token: token }),
    });
    localStorage.setItem('fcm_token', token);
    console.log('[FCM] Token saved to backend:', token.slice(-10));
  } catch (e) {
    console.warn('[FCM] Could not save token:', e);
  }
};

export const syncFCMToken = async (): Promise<void> => {
  const token = localStorage.getItem('fcm_token');
  if (!token) return;
  console.log('[FCM] Syncing FCM token to backend...');
  await saveFCMToken(token);
};

export const initCapacitorPush = async (): Promise<void> => {
  if (!isNativeApp()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') {
      console.warn('[FCM] Push permission not granted');
      return;
    }

    // Create default channel for Android (importance 5 triggers heads-up alert popup)
    try {
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Default Channel',
        description: 'General push notifications',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });
      console.log('[FCM] Android push channel created successfully');
    } catch (channelError) {
      console.warn('[FCM] Failed to create push channel:', channelError);
    }

    // Register with FCM
    await PushNotifications.register();

    // FCM Token received
    PushNotifications.addListener('registration', (token) => {
      console.log('[FCM] Native token received:', token.value.slice(-10));
      localStorage.setItem('fcm_token', token.value); // Cache always!
      saveFCMToken(token.value);
    });

    // Registration error
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[FCM] Registration error:', err.error);
    });

    // Foreground push received — show toast
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM] Push received in foreground:', notification.title);
      // Import toast dynamically to avoid circular dependency
      import('react-hot-toast').then(({ default: toast }) => {
        toast(`🔔 ${notification.title}: ${notification.body}`, {
          duration: 5000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          },
        });
      });
    });

    // User tapped on notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[FCM] Notification tapped:', action.notification.data);
      const data = action.notification.data || {};
      // Navigate based on notification type
      if (data.type === 'comment' || data.type === 'closed' || data.type === 'new_ticket') {
        window.location.hash = '#/help-center';
      } else if (data.type === 'approved' || data.type === 'rejected') {
        window.location.hash = '#/submit-expense';
      } else if (data.type === 'forwarded' || data.type === 'pending') {
        window.location.hash = '#/approval-center';
      }
    });

    console.log('[FCM] Capacitor Push Notifications initialized');
  } catch (e) {
    console.warn('[FCM] Capacitor push init failed:', e);
  }
};

// ─── App Lifecycle (handle background → foreground) ──────────────────────────
export const initAppLifecycle = async (): Promise<void> => {
  if (!isNativeApp()) return;
  try {
    const { App } = await import('@capacitor/app');
    const { SplashScreen } = await import('@capacitor/splash-screen');

    // Hide splash screen
    await SplashScreen.hide();

    // App state changes
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        // App came to foreground — restore session if needed
        if (!localStorage.getItem('access_token')) {
          const { tokenPersistence } = await import('./persistence');
          await tokenPersistence.restore();
        }
      }
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.minimizeApp(); // Minimize instead of exit
      } else {
        window.history.back();
      }
    });

    console.log('[Capacitor] App lifecycle initialized');
  } catch (e) {
    console.warn('[Capacitor] App lifecycle init failed:', e);
  }
};

/**
 * Initialize all Capacitor native features
 * Call this once on app startup
 */
export const initCapacitor = async (): Promise<void> => {
  if (!isNativeApp()) {
    console.log('[Capacitor] Running in browser — skipping native init');
    return;
  }

  console.log('[Capacitor] Native app detected — initializing...');
  await initAppLifecycle();
  await initCapacitorPush();
  console.log('[Capacitor] All native features initialized ✅');
};
