import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Bell } from "lucide-react";
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
        toast.custom(
          (t) => (
            <div
              className={`flex items-start gap-3 bg-white border border-gray-200 shadow-lg rounded-lg p-3.5 max-w-sm w-full ${
                t.visible ? "animate-slideIn" : "opacity-0"
              }`}
              onClick={() => toast.dismiss(t.id)}
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 leading-tight">{title}</p>
                {body && (
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{body}</p>
                )}
              </div>
            </div>
          ),
          { duration: 5000, position: "top-right" }
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
