/*
 * 微澜习惯 - Service Worker
 * 功能：离线缓存 + 浏览器通知提醒
 * 版本：v5 (修复通知 + 数据持久化增强版)
 */

const CACHE_NAME = 'weilan-v5';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.png',
  './favicon.ico'
];

/* ========== 安装 / 缓存 ========== */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => 
          cache.add(url).catch(err => {
            console.warn('[SW] 缓存失败:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ========== 激活 / 清理旧缓存 ========== */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* ========== 请求拦截 ========== */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // HTML: 网络优先（保证最新版本，缓存作为离线回退）
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 其他静态资源: 缓存优先
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});

/* ========== 接收页面消息（通知相关） ========== */
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    /* 立即显示通知 */
    case 'show_notification':
      showReminderNotification(data.title, data.body);
      break;

    /* 定时提醒：后台时触发 */
    case 'schedule_reminder':
      scheduleBackgroundReminder(data);
      break;

    /* 取消定时提醒 */
    case 'cancel_reminder':
      cancelBackgroundReminder();
      break;
  }
});

/* ========== 定时器管理 ========== */
let _reminderTimerId = null;

function cancelBackgroundReminder() {
  if (_reminderTimerId) {
    clearTimeout(_reminderTimerId);
    _reminderTimerId = null;
  }
}

function scheduleBackgroundReminder(data) {
  cancelBackgroundReminder();

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [h, m] = (data.reminderTime || '21:00').split(':').map(Number);
  const reminderMinutes = h * 60 + m;
  const diffMinutes = reminderMinutes - nowMinutes;

  if (diffMinutes <= 0) return;

  const today = new Date().toDateString();
  if (data.lastSent === today) return;

  const delayMs = diffMinutes * 60 * 1000;

  _reminderTimerId = setTimeout(() => {
    showReminderNotification(
      data.title || '微澜习惯',
      data.body || '该打卡复盘了 ✨ 记录今天的习惯评分吧'
    );
    cancelBackgroundReminder();
  }, delayMs);
}

/* ========== 显示通知（SW 方法，在后台也可用） ========== */
function showReminderNotification(title, body) {
  const options = {
    body: body || '今日习惯复盘时间到了',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'weilan-reminder',
    requireInteraction: true,
    data: { url: './index.html' }
  };

  self.registration.showNotification(title || '微澜习惯', options);

  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'notification_sent',
        date: new Date().toDateString()
      });
    });
  });
}

/* ========== 通知点击 ========== */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
      for (const client of clientsList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
