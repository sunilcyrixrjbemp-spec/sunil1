import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cyrixhealthcare.fieldops',
  appName: 'Field Ops',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // The app is self-contained (web assets bundled into APK)
    // API calls go to the production backend URL set in the web app
    cleartext: false,
  },
  android: {
    backgroundColor: '#0f172a',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
