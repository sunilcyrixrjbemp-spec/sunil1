/**
 * Median.co (GoNative) WebView Bridge Integration
 * 
 * Median.co wraps our web app in a native Android WebView.
 * This module handles:
 * 1. Native push notification token from Median.co's FCM bridge
 * 2. Native session persistence using Median.co's native storage API
 * 3. App resume/foreground events from Median.co
 * 
 * Median.co docs: https://median.co/docs
 */

const rawApiUrl = import.meta.env.VITE_API_URL as string || "";
const API_BASE = (rawApiUrl && !rawApiUrl.includes("onrender.com")) ? rawApiUrl : "https://fieldops-secondary-api.sunnybishnoi.workers.dev";

/**
 * Detect if running inside Median.co WebView wrapper
 */
export const isMedianApp = (): boolean => {
  return !!(
    (window as any).median ||
    (window as any).gonative ||
    navigator.userAgent.includes("Median") ||
    navigator.userAgent.includes("GoNative")
  );
};

/**
 * Save FCM token to backend
 */
const saveFCMTokenToBackend = async (token: string): Promise<void> => {
  try {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken || !token) return;
    await fetch(`${API_BASE}/api/users/fcm-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fcm_token: token }),
    });
    console.log("[Median] FCM token saved to backend");
  } catch (e) {
    console.log("[Median] Could not save FCM token:", e);
  }
};

/**
 * Register Median.co push notification listener.
 * Median.co calls window.median_push_registration(data) with FCM token.
 * We intercept this and save to our backend.
 */
export const registerMedianPushListener = (): void => {
  // Method 1: Median.co calls this global function with push token
  (window as any).median_push_registration = (data: any) => {
    console.log("[Median] Push registration received:", data);
    const token = data?.token || data?.registrationId || data;
    if (token && typeof token === "string") {
      localStorage.setItem("fcm_token", token);
      saveFCMTokenToBackend(token);
    }
  };

  // Method 2: GoNative/Median fires a CustomEvent
  window.addEventListener("gonative.push.registration", (event: any) => {
    const token = event?.detail?.token || event?.detail?.registrationId;
    if (token) {
      console.log("[Median] Push token via event:", token);
      localStorage.setItem("fcm_token", token);
      saveFCMTokenToBackend(token);
    }
  });

  // Method 3: Some Median versions use postMessage
  window.addEventListener("message", (event: MessageEvent) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data?.event === "push.registration" || data?.type === "push_token") {
        const token = data?.token || data?.registrationId;
        if (token) {
          console.log("[Median] Push token via postMessage:", token);
          localStorage.setItem("fcm_token", token);
          saveFCMTokenToBackend(token);
        }
      }
    } catch (_) {}
  });

  console.log("[Median] Push notification listeners registered");
};

/**
 * Register Median.co app lifecycle listeners.
 * When app resumes from background, restore localStorage from IndexedDB.
 */
export const registerMedianLifecycleListeners = (): void => {
  // Median.co fires this when app comes to foreground
  (window as any).median_app_resumed = () => {
    console.log("[Median] App resumed from background — checking session...");
    if (!localStorage.getItem("access_token")) {
      import("./persistence").then(({ tokenPersistence }) => {
        tokenPersistence.restore().then(() => {
          if (localStorage.getItem("access_token")) {
            console.log("[Median] Session restored on resume");
            // If on login page but we restored token, navigate to home
            if (window.location.hash === "#/login" || window.location.hash === "#/") {
              window.location.hash = "#/home";
            }
          }
        });
      });
    }
  };

  // Also handle via document event
  document.addEventListener("median.app.resumed", () => {
    (window as any).median_app_resumed?.();
  });

  // Standard visibilitychange as additional fallback
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !localStorage.getItem("access_token")) {
      import("./persistence").then(({ tokenPersistence }) => {
        tokenPersistence.restore();
      });
    }
  });

  console.log("[Median] Lifecycle listeners registered");
};

/**
 * Enable Median.co native push notifications.
 * This tells Median.co to register for FCM push notifications.
 */
export const requestMedianPushPermission = (): void => {
  try {
    // Method 1: Direct Median.co API call
    if ((window as any).median?.push?.requestPermission) {
      (window as any).median.push.requestPermission();
      console.log("[Median] Push permission requested via median.push API");
      return;
    }

    // Method 2: GoNative bridge
    if ((window as any).gonative?.push?.requestPermission) {
      (window as any).gonative.push.requestPermission();
      console.log("[Median] Push permission requested via gonative.push API");
      return;
    }

    // Method 3: JavaScript bridge URL scheme
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = "gonative://push/requestPermission";
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 1000);
    console.log("[Median] Push permission requested via URL scheme");
  } catch (e) {
    console.log("[Median] Could not request push permission:", e);
  }
};

/**
 * Initialize all Median.co integrations
 * Call this once on app startup
 */
export const initMedianIntegration = (): void => {
  if (!isMedianApp()) {
    // Not running in Median.co — skip
    return;
  }

  console.log("[Median] Median.co WebView detected — initializing bridge...");

  // Register push notification listener first
  registerMedianPushListener();

  // Register app lifecycle listeners (for session restore on resume)
  registerMedianLifecycleListeners();

  // Request push permission after a short delay (let app load first)
  setTimeout(() => {
    requestMedianPushPermission();
  }, 2000);

  console.log("[Median] Bridge initialization complete");
};
