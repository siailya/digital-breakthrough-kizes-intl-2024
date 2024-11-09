<template>
  <n-layout class="h-screen">
    <n-layout-header>
      <div class="h-[64px] flex p-3 justify-between items-center px-4 container mx-auto">
        <router-link
          to="/"
          class="text-3xl font-bold"
        >
          S<span class="text-cyan-500">I</span>
        </router-link>
        <n-button @click="onClickThemeChange">
          <n-icon>
            <IcOutlineNightsStay/>
          </n-icon>
        </n-button>
      </div>
    </n-layout-header>
    <n-layout-content
      content-style="padding: 1rem"
      class="container mx-auto"
      style="min-height: calc(100% - 64px - 32px)"
    >
      <slot></slot>
    </n-layout-content>
    <n-layout-footer class="h-[32px] flex items-center justify-center">
      <div class="container mx-auto text-center opacity-50">
        Создано командой <span class="font-bold">KIZES</span> в рамках хакатона "Цифровой Прорыв", кейс "Классификация
        электрокортикограмм"
      </div>
    </n-layout-footer>
  </n-layout>
</template>

<script lang="ts" setup>
import { useRootStore } from '@shared/model/store/useRootStore';
import IcOutlineNightsStay from '@shared/ui/icons/MoonIcon.vue';

const root = useRootStore();

const onClickThemeChange = () => {
  if (root.theme === 'dark') {
    root.setTheme('light');
  } else {
    root.setTheme('dark');
  }
};
</script>

<style scoped>

</style>