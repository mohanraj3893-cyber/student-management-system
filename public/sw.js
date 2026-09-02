// Student Management System - Cloudflare Native Service Worker
// Handles PWA offline caching, background Push notifications, and notification clicks

const CACHE_NAME = 'sms-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/manifest.webmanifest',
  '/favicon.svg'
];

// 1. Service Worker Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Pre-cache skipped for non-critical assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Service Worker Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Web Push Notification Listener (Runs in Background on PC & Mobile)
self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Student Management System',
        body: event.data.text() || 'You have a new update.'
      };
    }
  } else {
    data = {
      title: 'Student Management System',
      body: 'You have a new update from the portal.'
    };
  }

  const title = data.title || 'Student Management System';
  const targetUrl = data.url || data.targetUrl || data.data?.url || '/dashboard.html';

  const options = {
    body: data.body || data.message || 'Check the portal for recent activity.',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || `sms-push-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    vibrate: [150, 75, 150],
    data: {
      url: targetUrl,
      timestamp: Date.now(),
      ...data
    },
    actions: [
      { action: 'open', title: 'Open Portal' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 4. Notification Click & Page Navigation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';

  // Normalize target URL to absolute URL
  const targetOriginUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if an SMS tab is already open
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetOriginUrl);
          return client.focus();
        }
      }
      // If no window is currently open, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetOriginUrl);
      }
    })
  );
});

// 5. Subscription Change (Automatic Renewal on Android / iOS / Desktop)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    fetch('/api/push/vapid-public-key')
      .then((res) => res.json())
      .then((keyData) => {
        if (!keyData.publicKey) throw new Error('No VAPID key available');
        const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
        return self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      })
      .then((newSubscription) => {
        const rawKey = newSubscription.getKey ? newSubscription.getKey('p256dh') : null;
        const rawAuth = newSubscription.getKey ? newSubscription.getKey('auth') : null;
        const p256dh = rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '';
        const auth = rawAuth ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth))) : '';

        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            endpoint: newSubscription.endpoint,
            keys: { p256dh, auth },
            userAgent: navigator.userAgent
          })
        });
      })
      .catch((err) => {
        console.error('Failed to renew push subscription:', err);
      })
  );
});

// Helper: Convert Base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
