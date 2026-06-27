import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBbqvVGyzn-HMutMGgElcBb70IkBjtPn9Q",
  authDomain: "indrae-740bb.firebaseapp.com",
  databaseURL: "https://indrae-740bb-default-rtdb.firebaseio.com",
  projectId: "indrae-740bb",
  storageBucket: "indrae-740bb.firebasestorage.app",
  messagingSenderId: "226030614617",
  appId: "1:226030614617:web:3b034e22cb6aac71f11948",
  measurementId: "G-H1S54TWSHZ"
};

// Initialize Firebase (avoid double-init in StrictMode)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// VAPID Key (Web Push Certificate) from Firebase Console
// HOW TO GET: Firebase Console → Project Settings → Cloud Messaging → 
//             Web configuration → Generate key pair → copy the "Key pair" value
// REQUIRED for Web Push to work on browsers & PWA
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

let messaging: Messaging | null = null;

/**
 * Initialize Firebase Messaging (only in supported browsers)
 */
export const initFirebaseMessaging = async (): Promise<Messaging | null> => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("FCM: Browser does not support push messaging");
      return null;
    }
    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.log("FCM: Failed to initialize messaging", error);
    return null;
  }
};

/**
 * Request notification permission and get FCM token
 * Returns the FCM token string or null if denied/unsupported
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      console.log("FCM: Notifications not supported in this browser");
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("FCM: Notification permission denied");
      return null;
    }

    // Initialize messaging if not done yet
    const msg = messaging || await initFirebaseMessaging();
    if (!msg) return null;

    // Register the service worker first
    let swReg: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      try {
        swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/"
        });
        await navigator.serviceWorker.ready;
      } catch (swError) {
        console.log("FCM: Service Worker registration failed", swError);
      }
    }

    // Get FCM token
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (token) {
      console.log("FCM: Token obtained successfully");
      return token;
    } else {
      console.log("FCM: No token received");
      return null;
    }
  } catch (error) {
    console.log("FCM: Error getting token", error);
    return null;
  }
};

/**
 * Listen to foreground messages (when app is open/focused)
 * Returns an unsubscribe function
 */
export const onForegroundMessage = (callback: (payload: any) => void): (() => void) => {
  if (!messaging) {
    return () => {};
  }
  const unsubscribe = onMessage(messaging, (payload) => {
    callback(payload);
  });
  return unsubscribe;
};

export { messaging };
export default app;
