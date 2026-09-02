// Client-Side Web Push Notification & Service Worker Manager
// Works on Windows, macOS, Android, and iOS (Safari PWA)

// Convert URL-safe base64 string to Uint8Array for applicationServerKey
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check push support
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Main initialization called after user authentication
export async function initPushNotifications(token) {
  if (!isPushSupported() || !token) return;

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 2. Check current notification permission
    if (Notification.permission === 'granted') {
      // Sync or refresh existing push subscription with backend
      await syncPushSubscription(registration, token);
    } else if (Notification.permission === 'default') {
      // Show friendly permission modal if not previously dismissed in this session
      if (!sessionStorage.getItem('sms_push_dismissed')) {
        showPushPermissionModal(registration, token);
      }
    }
  } catch (error) {
    console.warn('[Push Notification] Registration skipped or not supported:', error);
  }
}

// Sync subscription with backend
export async function syncPushSubscription(registration, token) {
  try {
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Fetch VAPID public key from backend
      const keyRes = await fetch('/api/push/vapid-public-key', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!keyRes.ok) return;
      const keyData = await keyRes.json();
      if (!keyData.publicKey) return;

      const convertedKey = urlBase64ToUint8Array(keyData.publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    if (subscription) {
      const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
      const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;
      const p256dh = rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '';
      const auth = rawAuth ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth))) : '';

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
          userAgent: navigator.userAgent
        })
      });
    }
  } catch (err) {
    console.warn('[Push Notification] Sync subscription failed:', err);
  }
}

// Friendly permission request modal
function showPushPermissionModal(registration, token) {
  const existingModal = document.getElementById('sms-push-modal');
  if (existingModal) return;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'sms-push-modal';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
    animation: fadeIn 0.25s ease-out;
  `;

  modalOverlay.innerHTML = `
    <div style="
      background: #FFFFFF;
      border-radius: 20px;
      padding: 2rem;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      text-align: center;
      border: 1px solid #E2E8F0;
      box-sizing: border-box;
      font-family: inherit;
    ">
      <div style="
        width: 64px;
        height: 64px;
        background: #EFF6FF;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.25rem auto;
        font-size: 2rem;
        color: #0056D2;
        box-shadow: 0 4px 12px rgba(0, 86, 210, 0.15);
      ">
        🔔
      </div>

      <h3 style="
        font-size: 1.35rem;
        font-weight: 800;
        color: #0F172A;
        margin: 0 0 0.5rem 0;
      ">
        Enable Notifications
      </h3>

      <p style="
        font-size: 0.9rem;
        color: #64748B;
        line-height: 1.5;
        margin: 0 0 1.75rem 0;
      ">
        Stay updated about leave approvals, attendance, internal marks, announcements, and registration approvals on this device.
      </p>

      <div style="display: flex; gap: 0.75rem; width: 100%;">
        <button id="push-btn-later" style="
          flex: 1;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          background: #F8FAFC;
          color: #64748B;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        ">
          Later
        </button>

        <button id="push-btn-enable" style="
          flex: 1.2;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #0056D2 0%, #0043A4 100%);
          color: #FFFFFF;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 86, 210, 0.25);
          transition: all 0.2s;
          font-family: inherit;
        ">
          Enable
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const btnLater = document.getElementById('push-btn-later');
  const btnEnable = document.getElementById('push-btn-enable');

  btnLater.addEventListener('click', () => {
    sessionStorage.setItem('sms_push_dismissed', 'true');
    modalOverlay.remove();
  });

  btnEnable.addEventListener('click', async () => {
    btnEnable.disabled = true;
    btnEnable.textContent = 'Enabling...';

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await syncPushSubscription(registration, token);
        modalOverlay.remove();
      } else {
        sessionStorage.setItem('sms_push_dismissed', 'true');
        modalOverlay.remove();
      }
    } catch (err) {
      console.error('[Push Notification] Permission request error:', err);
      modalOverlay.remove();
    }
  });
}
