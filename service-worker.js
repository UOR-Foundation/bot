// service-worker.js
self.addEventListener('install', event => {
  console.log('Service Worker installed.');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activated.');
});

self.addEventListener('fetch', event => {
  // This example just passes all requests to the network.
  event.respondWith(fetch(event.request));
});
