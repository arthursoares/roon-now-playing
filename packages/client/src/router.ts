import { createRouter, createWebHistory } from 'vue-router';
import NowPlayingView from './views/NowPlayingView.vue';
import AdminView from './views/AdminView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'now-playing',
      component: NowPlayingView,
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
    },
  ],
});

export default router;
