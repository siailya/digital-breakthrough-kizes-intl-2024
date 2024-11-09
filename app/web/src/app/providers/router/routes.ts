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
    path: '/login',
    component: () => import("@/pages/auth/TheLoginView.vue")
  }
];