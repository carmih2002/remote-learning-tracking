// Firebase Messaging Service Worker
// Handles background push notifications when the app is closed or in the background.
// Must be served from the root of the domain (e.g. /firebase-messaging-sw.js).

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBfE6cEKvBc1-t-wgQn1ZhgEXZd58mSuWA",
  authDomain:        "remote-learning-tracking.firebaseapp.com",
  projectId:         "remote-learning-tracking",
  storageBucket:     "remote-learning-tracking.firebasestorage.app",
  messagingSenderId: "665503380173",
  appId:             "1:665503380173:web:d5a224a8279096e072ef84"
});

const messaging = firebase.messaging();

// Display a notification when the app is in the background
messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title || 'התראה חדשה';
  const body  = payload.notification?.body  || '';

  self.registration.showNotification(title, {
    body,
    icon:  '/icon.png',   // replace with your actual icon path if you have one
    badge: '/icon.png',
    tag:   'teacher-reply', // deduplicate: only one notification at a time per tag
    data:  { url: self.location.origin },
  });
});

// Open / focus the app when the user taps the notification
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // Focus an existing tab if one is already open
        for (const client of clientList) {
          if (client.url.startsWith(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
