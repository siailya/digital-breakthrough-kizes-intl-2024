<template>
  <div>
    <h2 class="text-6xl font-medium text-center mb-12">
      Sleep<span class="text-cyan-500">Insight</span>
    </h2>

    <div>
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
        <div class="flex gap-4">
          <div class="w-1/2 mx-auto">
            <n-descriptions bordered>
              <n-descriptions-item label="ID задачи">
                {{ taskData.uid }}
              </n-descriptions-item>
              <n-descriptions-item label="Имя файла">
                {{ taskData.filename }}
              </n-descriptions-item>
              <n-descriptions-item label="Статус">
                <n-tag :type="taskData.status === 'completed' ? 'info' : 'warning'">
                  {{ taskData.status === 'completed' ? 'завершено' : 'в обработке' }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="Дата">
                {{ new Date(taskData.date).toLocaleString() }}
              </n-descriptions-item>
              <n-descriptions-item label="Дата окончания">
                {{ taskData.status === 'completed' && taskData.completedDate ? new Date(taskData.completedDate).toLocaleString() : '—'
                }}
              </n-descriptions-item>
              <n-descriptions-item label="Скачать Excel">
                <n-button
                  :loading="isDownloading"
                  @click="handleExcelDownload"
                >
                  Скачать Excel
                </n-button>
              </n-descriptions-item>
            </n-descriptions>
          </div>
          <n-card>
            <template #header>
              <div class="text-lg">События</div>
            </template>
            <n-data-table
              :columns="eventColumns"
              :data="taskData.events || []"
              :pagination="{ pageSize: 10 }"
              :bordered="false"
              striped
              :max-height="250"
            />
          </n-card>
        </div>

        <div class="w-full">
          <template v-if="taskData.status === 'pending'">
            <div class="mt-4 text-center">
              <n-spin size="small" />
              <p class="mt-2">Обработка файла...</p>
            </div>
          </template>

          <template v-if="taskData.decimatedData">
            <div class="mt-4">
              <EdfChart
                ref="mainChartRef"
                :channels="chartData"
                :annotations="rangeAnnotations"
                v-memo="[chartData, timeStart, timeEnd]"
              />
            </div>

            <div class="mt-8">
              <h3 class="text-2xl font-medium mb-4">Детальный просмотр</h3>
              
              <n-collapse>
                <n-collapse-item title="Инструкция по использованию">
                  <p>Для детального просмотра данных:</p>
                  <ol class="list-decimal list-inside mt-2">
                    <li>Укажите начальное время (в секундах) в первом поле</li>
                    <li>Укажите конечное время во втором поле</li>
                    <li>
                      Настройте фактор прореживания данных (1-400):
                      <ul class="list-disc list-inside ml-4">
                        <li>Меньшее значение = более детальный вид</li>
                        <li>Большее значение = более общий вид</li>
                      </ul>
                    </li>
                  </ol>
                </n-collapse-item>
              </n-collapse>

              <div class="flex gap-4 mb-4 mt-4">
                <n-input-number
                  v-model:value="timeStart"
                  :min="0"
                  placeholder="Начало (сек)"
                  @update:value="handleTimeRangeChange"
                />
                <n-input-number
                  v-model:value="timeEnd"
                  :min="0"
                  placeholder="Конец (сек)"
                  @update:value="handleTimeRangeChange"
                />
                <n-input-number
                  v-model:value="factor"
                  :min="1"
                  :max="400"
                  placeholder="Фактор"
                  @update:value="handleTimeRangeChange"
                />

                <div class="text-sm text-gray-500 mt-1">
                  {{ scaleInfo }}
                </div>
              </div>

              <div
                v-if="rangeError"
                class="mb-4"
              >
                <n-alert
                  type="error"
                  :title="rangeError"
                />
              </div>

              <div v-if="isLoadingRange">
                <n-spin size="small" />
                <p class="mt-2">Загрузка данных...</p>
              </div>

              <div v-else-if="rangeChartData.length">
                <EdfChart
                  v-if="rangeChartData.length"
                  :channels="rangeChartData"
                  v-memo="rangeChartData"
                />
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { apiInstance } from '@/app/api/api';
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import EdfChart from '@/components/EdfChart.vue';
import type { DataTableColumns } from 'naive-ui';
import { NAlert, NButton, NDataTable, NInputNumber } from 'naive-ui';
import { debounce } from 'lodash-es';
import { Annotation } from '@components/model';

interface Event {
  type: number;
  time: {
    start: number;
    end: number;
  };
  confidence: number;
}

interface TaskData {
  _id: string;
  uid: string;
  date: string;
  filename: string;
  status: 'pending' | 'completed';
  completedDate?: string;
  decimatedData?: Array<{
    label: string;
    decimatedData: number[];
  }>;
  events?: Array<Event>;
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
      if (taskData.value?.decimatedData && !chartData.value.length) {
        chartData.value = taskData.value!.decimatedData as any;
      }
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

const chartData = ref<any>([]);

const timeStart = ref<number | null>(null);
const timeEnd = ref<number | null>(null);
const rangeChartData = ref<any>([]);
const isLoadingRange = ref(false);
const rangeError = ref<string | null>(null);

const factor = ref(400);
const SAMPLES_PER_SECOND = 400;
const MAX_SAMPLES = 40000;

// Добавляем ref для хранения контроллера
const abortController = ref<AbortController | null>(null);

const handleTimeRangeChange = debounce(async () => {
  rangeError.value = null;

  if (timeStart.value === null || timeEnd.value === null) {
    return;
  }

  if (timeEnd.value <= timeStart.value) {
    rangeError.value = 'Конец должен быть больше начала';
    return;
  }

  const durationSeconds = timeEnd.value - timeStart.value;
  const totalSamples = (durationSeconds * SAMPLES_PER_SECOND) / factor.value;

  if (totalSamples > MAX_SAMPLES) {
    const maxSeconds = (MAX_SAMPLES * factor.value) / SAMPLES_PER_SECOND;
    rangeError.value = `При факторе ${factor.value} максимальный интервал - ${maxSeconds.toFixed(1)} секунд`;
    return;
  }

  try {
    // Отменяем предыдущий запрос, если он есть
    if (abortController.value) {
      abortController.value.abort();
    }

    // Создаем новый контроллер
    abortController.value = new AbortController();
    isLoadingRange.value = true;

    const response = await apiInstance.get(`/processing/data/${route.params.uid}`, {
      params: {
        factor: factor.value,
        start: timeStart.value,
        end: timeEnd.value
      },
      signal: abortController.value.signal
    });

    if (response.data.success) {
      rangeChartData.value = response.data.responseObject;
    } else {
      rangeError.value = response.data.message;
    }
  } catch (err) {
    // Игнорируем ошибку, если запрос был отменен
    if ((err as any).name === 'CanceledError') {
      return;
    }
    rangeError.value = 'Ошибка при загрузке данных';
    console.error(err);
  } finally {
    isLoadingRange.value = false;
    abortController.value = null;
  }
}, 1000);

const scaleInfo = computed(() => {
  if (!factor.value) return '';
  
  const samplesPerSecond = SAMPLES_PER_SECOND / factor.value;
  return `${samplesPerSecond} точек/сек`;
});

const getEventColor = (type: number): { bg: string; border: string } => {
  switch (type) {
  case 1:
    return {
      bg: 'rgba(40,243,33,0.2)', // голубой
      border: '#67f321'
    };
  case 2:
    return {
      bg: 'rgba(255, 235, 59, 0.2)', // желтый
      border: '#ffc107'
    };
  case 3:
    return {
      bg: 'rgba(244, 67, 54, 0.2)', // красный
      border: '#f44336'
    };
  default:
    return {
      bg: 'rgba(158, 158, 158, 0.2)', // серый (по умолчанию)
      border: '#9e9e9e'
    };
  }
};

const rangeAnnotations = computed<Annotation[]>(() => {
  const annotations: Annotation[] = [];

  // Временные метки
  if (timeStart.value !== null) {
    annotations.push({
      type: 'line',
      xMin: timeStart.value,
      xMax: timeStart.value,
      borderColor: '#2196f3',
      borderWidth: 2,
      label: {
        content: `Начало: ${timeStart.value}с`,
        enabled: true,
        position: 'start'
      }
    });
  }

  if (timeEnd.value !== null) {
    annotations.push({
      type: 'line',
      xMin: timeEnd.value,
      xMax: timeEnd.value,
      borderColor: '#f44336',
      borderWidth: 2,
      label: {
        content: `Конец: ${timeEnd.value}с`,
        enabled: true,
        position: 'end'
      }
    });
  }

  // События
  if (taskData.value?.status === 'completed' && taskData.value.events) {
    taskData.value.events.forEach(event => {
      const colors = getEventColor(event.type);
      annotations.push({
        type: 'box',
        xMin: event.time.start,
        xMax: event.time.end,
        yMin: -10,
        yMax: 10,
        adjustScaleRange: false,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 0,
        label: {
          content: `Событие ${event.type} (${event.confidence.toFixed(2)})`,
          enabled: true,
          position: 'start'
        }
      });
    });
  }

  return annotations;
});

const viewEvent = (event: any) => {
  // Устанавливаем временной диапазон с небольшим отступом
  const padding = 2; // 2 секунды до и после события
  timeStart.value = Math.max(0, event.time.start - padding);
  timeEnd.value = event.time.end + padding;
  
  // Автоматически подбираем фактор прореживания
  const duration = timeEnd.value! - timeStart.value;
  const suggestedFactor = Math.ceil((duration * SAMPLES_PER_SECOND) / MAX_SAMPLES);
  factor.value = Math.max(1, Math.min(400, suggestedFactor));
  
  // Запускаем загрузку данных
  handleTimeRangeChange();
};

onMounted(() => {
  fetchTaskData();
  intervalId = window.setInterval(fetchTaskData, 10000);
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  if (abortController.value) {
    abortController.value.abort();
  }
  handleTimeRangeChange.cancel();
});

const eventColumns: DataTableColumns = [
  {
    title: 'Тип события',
    key: 'type',
  },
  {
    title: 'Время начала (с)',
    key: 'timeStart',
    render: (row: any) => row.time.start
  },
  {
    title: 'Время окончания (с)',
    key: 'timeEnd',
    render: (row: any) => row.time.end
  },
  {
    title: 'Длительность (с)',
    key: 'duration',
    render: (row: any) => (row.time.end - row.time.start).toFixed(1)
  },
  {
    title: 'Достоверность',
    key: 'confidence',
    render: (row: any) => row.confidence.toFixed(2)
  },
  {
    title: 'Действия',
    key: 'actions',
    render: (row: any) => h(
      NButton,
      {
        size: 'small',
        onClick: () => viewEvent(row)
      },
      { default: () => 'Посмотреть' }
    )
  }
];

// Добавляем ref для доступа к EdfChart компоненту
const mainChartRef = ref<InstanceType<typeof EdfChart> | null>(null);

// Обновляем watch для зума основного графика при изменении временного диапазона
watch([timeStart, timeEnd], ([newStart, newEnd]) => {
  if (newStart !== null && newEnd !== null && mainChartRef.value) {
    console.log(mainChartRef.value, newStart, newEnd);
    mainChartRef.value.zoomTo(newStart, newEnd);
  }
});

const isDownloading = ref(false);

const handleExcelDownload = async () => {
  if (!taskData.value?.uid) return;

  isDownloading.value = true;
  try {
    const response = await apiInstance.get(`/processing/export/${taskData.value.uid}`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${taskData.value.filename}_analysis.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download Excel file:', err);
  } finally {
    isDownloading.value = false;
  }
};
</script>
