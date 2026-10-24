import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/notes'
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('../views/NotesView/Index.vue')
    },
    {
      path: '/knowledge',
      name: 'knowledge',
      component: () => import('../views/KnowledgeDashboard/Index.vue')
    },
    {
      path: '/taxonomy',
      name: 'taxonomy',
      redirect: '/notes'
    },
    {
      path: '/challenge',
      name: 'challenge',
      component: () => import('../views/ChallengeMode/Index.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/notes' }
  ]
});

export default router;
