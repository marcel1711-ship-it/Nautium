import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BLUp5pcn094JMTnXlgxovS9Wyv7xGGtILLa3xtGzArnZ7keP0O29PEIHLda3o5OdONDvXhKrywIu5Wt2jxbDzvg';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPermissionState(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function subscribeToPush(userId: string, companyId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = subscription.toJSON();

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      company_id: companyId,
      endpoint: subJson.endpoint,
      keys_p256dh: subJson.keys?.p256dh ?? '',
      keys_auth: subJson.keys?.auth ?? '',
    }, {
      onConflict: 'user_id,endpoint',
    });

    return !error;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
  } catch { /* best-effort */ }
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
