self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  // Only intercept same-origin requests; let external API calls (OCR, Gemini, Groq)
  // pass through the browser directly so CORS headers are handled normally.
  if (new URL(e.request.url).origin === self.location.origin) {
    e.respondWith(fetch(e.request));
  }
});
