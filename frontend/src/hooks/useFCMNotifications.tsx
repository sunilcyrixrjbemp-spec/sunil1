import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import {
  initFirebaseMessaging,
  requestNotificationPermission,
  onForegroundMessage
} from "../utils/firebase";
import api from "../services/api";

/**
 * Save FCM token to backend so the server can send push notifications
 */
const saveFCMToken = async (token: string) => {
  try {
    await api.post("/users/fcm-token", { fcm_token: token });
    console.log("FCM: Token saved to backend successfully via Axios");
  } catch (error) {
    // Silent fail — non-critical
    console.log("FCM: Failed to save token to backend", error);
  }
};

/**
 * useFCMNotifications hook
 * - Requests permission on mount (after a delay to not interrupt UX)
 * - Registers FCM token with backend
 * - Shows toast notifications for foreground messages
 */
export const useFCMNotifications = () => {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Delay by 3s to let the app finish mounting before asking permission
    const timer = setTimeout(async () => {
      // Initialize Firebase Messaging
      await initFirebaseMessaging();

      // Request notification permission and get token
      const token = await requestNotificationPermission();

      if (token) {
        // Save token to backend
        await saveFCMToken(token);

        // Store token locally for re-registration on re-login
        localStorage.setItem("fcm_token", token);
      }

      // Listen for foreground messages (app is open)
      unsubscribeRef.current = onForegroundMessage((payload) => {
        const title = payload.notification?.title || "New Notification";
        const body = payload.notification?.body || "";

        // Show a custom toast notification
        toast(
          (t) => (
            <div className="flex flex-col gap-0.5 pr-2 select-none" onClick={() => toast.dismiss(t.id)}>
              <span className="font-bold text-[#1a202c] text-xs uppercase tracking-wide">
                {title}
              </span>
              {body && (
                <span className="text-[10px] text-gray-500 font-semibold leading-normal">
                  {body}
                </span>
              )}
            </div>
          ),
          {
            icon: "🔔",
            duration: 5000,
            position: "top-right"
          }
        );
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);
};

export default useFCMNotifications;
