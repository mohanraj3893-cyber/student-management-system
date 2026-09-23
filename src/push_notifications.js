// =====================================================================
// Cloudflare Native Web Push Notification Manager (Client Side)
// =====================================================================

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push Notification] Push messaging is not supported by this browser.');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push Notification] ServiceWorker registered successfully:', reg.scope);

    // Check current permission
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.log('[Push Notification] Notification permission was denied or dismissed.');
      return false;
    }

    // Fetch VAPID public key from Cloudflare Worker
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) {
      console.warn('[Push Notification] Could not fetch VAPID key from Worker.');
      return false;
    }
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
    }

    // Send subscription payload to Cloudflare D1
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sub)
      });
      console.log('[Push Notification] Browser successfully registered for Cloudflare Native Push.');
    }
    return true;
  } catch (err) {
    console.warn('[Push Notification] Error setting up Push Notifications:', err);
    return false;
  }
}

// Attach globally for pages
if (typeof window !== 'undefined') {
  window.initPushNotifications = initPushNotifications;
}
