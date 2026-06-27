// Firebase Cloud Messaging Service Worker
// This file MUST be at /public/firebase-messaging-sw.js (served from root)
// It handles background push notifications when the app is not in focus

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Firebase configuration — must match src/utils/firebase.ts
firebase.initializeApp({
  apiKey: "AIzaSyBbqvVGyzn-HMutMGgElcBb70IkBjtPn9Q",
  authDomain: "indrae-740bb.firebaseapp.com",
  databaseURL: "https://indrae-740bb-default-rtdb.firebaseio.com",
  projectId: "indrae-740bb",
  storageBucket: "indrae-740bb.firebasestorage.app",
  messagingSenderId: "226030614617",
  appId: "1:226030614617:web:3b034e22cb6aac71f11948",
  measurementId: "G-H1S54TWSHZ"
});

const messaging = firebase.messaging();

// Handle background messages (app in background / closed)
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Received background message:", payload);

  const notificationTitle = payload.notification?.title || "Cyrix FieldOps";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new notification",
    icon: "/brand.png",
    badge: "/brand.png",
    data: payload.data || {},
    tag: "cyrix-fieldops-notification",
    requireInteraction: false,
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  // Open or focus the app
  const appUrl = self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.startsWith(appUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(appUrl + "/home");
      }
    })
  );
});
