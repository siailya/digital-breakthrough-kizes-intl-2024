<template>
  <div>
    <h2 class="text-6xl font-medium text-center mb-12">
      Sleep<span class="text-cyan-500">Insight</span>
    </h2>

    <div class="w-1/2 mx-auto">
      <template v-if="isLoading">
        <div class="text-center">
          <n-spin size="large" />
          <p class="mt-4">Обработка</p>
        </div>
      </template>

      <template v-else-if="error">
        <n-alert
          type="error"
          :title="error"
        />
      </template>

      <template v-else-if="taskData">
        <n-card>
          <n-descriptions bordered>
            <n-descriptions-item label="ID задачи">
              {{ taskData.uid }}
            </n-descriptions-item>
            <n-descriptions-item label="Имя файла">
              {{ taskData.filename }}
            </n-descriptions-item>
            <n-descriptions-item label="Статус">
              <n-tag :type="taskData.status === 'completed' ? 'success' : 'warning'">
                {{ taskData.status === 'completed' ? 'завершено' : 'в обработке' }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="Дата">
              {{ new Date(taskData.date).toLocaleString() }}
            </n-descriptions-item>
            <n-descriptions-item label="Дата окончания">
              {{ taskData.status === 'completed' && taskData.completedDate ? new Date(taskData.completedDate).toLocaleString() : '—' }}
            </n-descriptions-item>
          </n-descriptions>

          <template v-if="taskData.status === 'pending'">
            <div class="mt-4 text-center">
              <n-spin size="small" />
              <p class="mt-2">Обработка файла...</p>
            </div>
          </template>
        </n-card>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { apiInstance } from '@/app/api/api';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';

interface TaskData {
  _id: string;
  uid: string;
  date: string;
  filename: string;
  status: 'pending' | 'completed';
  completedDate?: string;
}

const route = useRoute();
const taskData = ref<TaskData | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
let intervalId: number | null = null;

const fetchTaskData = async () => {
  try {
    const response = await apiInstance.get(`/processing/tasks/${route.params.uid}`);

    if (response.data.success) {
      taskData.value = response.data.responseObject;
    } else {
      error.value = response.data.message;
    }
  } catch (err) {
    error.value = 'Failed to fetch task data';
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchTaskData();
  // Update every second
  intervalId = window.setInterval(fetchTaskData, 1000);
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});
</script>
