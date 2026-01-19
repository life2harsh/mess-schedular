const SW_VERSION = 'v17688050sds74';
const CACHE_NAME = `mess-schedule-cache-${SW_VERSION}`;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './service-worker.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
              return null;
            })
          )
        );
      })
      .then(results => {
        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;
      })
      .catch(err => {
        console.error('Cache failed:', err);
      })
  );
  
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});

self.addEventListener('push', event => {
  let pushData = {};
  
  if (event.data) {
    try {
      pushData = event.data.json();
    } catch (e) {
      pushData = {
        title: 'Mess Notification',
        body: event.data.text() || 'You have a new notification!',
        actions: []
      };
    }
  } else {
    pushData = {
      title: 'Mess Notification',
      body: 'You have a new notification!',
      actions: []
    };
  }

  const options = {
    body: pushData.body || 'New notification',
    icon: './icon.png',
    badge: './icon.png',
    tag: pushData.tag || 'default',
    requireInteraction: pushData.requireInteraction || false,
    silent: pushData.silent || false,
    actions: pushData.actions || [],
    data: pushData.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(pushData.title || 'Mess Notification', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'vote-good' || action === 'vote-bad' || action === 'vote-skip') {
    const voteType = action.replace('vote-', '');
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          if (clientList.length > 0) {
            const client = clientList[0];
            client.postMessage({
              type: 'notification-click',
              action: action,
              voteType: voteType,
              data: data
            });
            return client.focus();
          } else {
            return clients.openWindow('./');
          }
        })
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          if (clientList.length > 0) {
            return clientList[0].focus();
          } else {
            return clients.openWindow('./');
          }
        })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});






