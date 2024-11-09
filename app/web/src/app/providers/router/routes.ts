import MainLayout from "@shared/ui/layout/TheMainLayout.vue";
import {RouteRecordRaw} from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/pages/home/TheHomeView.vue'),
    meta: {
      layout: MainLayout
    }
  },
  {
    path: '/processing/:uid',
    component: () => import('@/pages/ProcessingView.vue'),
    meta: {
      layout: MainLayout
    }
  }
];