<template>
  <div>
    <h2 class="text-6xl font-medium text-center mb-12">Sleep<span class="text-cyan-500">Insight</span></h2>
    <n-upload
      :action="BACKEND_URL + '/processing/upload'"
      accept=".edf"
      response-type="json"
      @finish="handleFinish"
      :disabled="isUploading"
      @before-upload="handleBeforeUpload"
    >
      <n-upload-dragger class="w-full">
        <div style="margin-bottom: 12px">
          <n-icon
            :depth="3"
            size="48"
          >
            <IcBaselineCloudUpload />
          </n-icon>
        </div>
        <n-text style="font-size: 16px">
          Нажмите или перетащите сюда файл
        </n-text>
        <n-p
          depth="3"
          style="margin: 8px 0 0 0"
        >
          Загрузите файл в формате EDF для анализа
        </n-p>
      </n-upload-dragger>
    </n-upload>

    <div class="mt-12 w-3/4 mx-auto">
      <h3 class="text-2xl font-medium mb-6">Последние обработки</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <n-card
          v-for="task in tasks"
          :key="task.uid"
          class="cursor-pointer hover:scale-105 transition-all"
          @click="router.push(`/processing/${task.uid}`)"
        >
          <div
            class="font-medium truncate mb-2"
            :title="task.filename"
          >
            {{ task.filename }}
          </div>
          <div class="text-sm text-gray-600">
            {{ new Date(task.date).toLocaleString() }}
          </div>
          <div class="mt-2">
            <n-tag :type="getStatusType(task.status)">
              {{ task.status }}
            </n-tag>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { BACKEND_URL } from '@/app/api/api';
import IcBaselineCloudUpload from '@shared/ui/icons/CloudUploadIcon.vue';
import { useRouter } from 'vue-router';

interface Task {
  _id: string;
  uid: string;
  date: string;
  filename: string;
  status: string;
}

const router = useRouter();
const tasks = ref<Task[]>([]);
const isUploading = ref(false);

const handleFinish = (data: any) => {
  isUploading.value = false;
  router.push(`/processing/${data.event.target.response.responseObject.uid}`);
};

const handleBeforeUpload = () => {
  isUploading.value = true;
  return true;
};

const fetchTasks = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/processing/tasks`);
    const data = await response.json();
    if (data.success) {
      tasks.value = data.responseObject;
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
  }
};

const getStatusType = (status: string) => {
  switch (status) {
  case 'completed':
    return 'info';
  case 'failed':
    return 'error';
  default:
    return 'warning';
  }
};

onMounted(() => {
  fetchTasks();
});
</script>