// Node 26 exposes experimental storage globals that shadow jsdom's working
// Storage instances. Client tests must always exercise the browser APIs.
Object.defineProperties(globalThis, {
  localStorage: {
    configurable: true,
    value: window.localStorage,
  },
  sessionStorage: {
    configurable: true,
    value: window.sessionStorage,
  },
});
