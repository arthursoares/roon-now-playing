import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import App from './App.vue';

describe('App', () => {
  it('mounts the route outlet without opening its own WebSocket', () => {
    const WebSocketMock = vi.fn();
    vi.stubGlobal('WebSocket', WebSocketMock);

    const app = createApp(App);
    app.component('router-view', defineComponent({
      render: () => h('div', { 'data-route-outlet': '' }),
    }));
    const host = document.createElement('div');
    app.mount(host);

    expect(host.querySelector('[data-route-outlet]')).not.toBeNull();
    expect(WebSocketMock).not.toHaveBeenCalled();

    app.unmount();
    vi.unstubAllGlobals();
  });
});
