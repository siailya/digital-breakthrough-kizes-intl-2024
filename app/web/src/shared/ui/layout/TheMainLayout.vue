<template>
  <main>
    <n-button @click="onClickThemeChange">
      theme
    </n-button>
    <slot></slot>
  </main>
</template>

<script lang="ts" setup>
import {useRootStore} from "@shared/model/store/useRootStore";
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