<template>
  <Line
    v-if="loaded"
    ref="chartRef"
    :data="chartData"
    :options="chartOptions"
    :style="chartStyle"
  />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale, ChartOptions,
} from 'chart.js';
import { Colors } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Annotation } from '@components/model';

ChartJS.register(
  Colors,
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
  zoomPlugin,
  annotationPlugin
);

interface Channel {
  label: string;
  decimatedData: number[];
}

interface Props {
  channels: Channel[];
  annotations?: Annotation[];
}

const props = withDefaults(defineProps<Props>(), {
  annotations: () => [],
});

const loaded = ref(true);
const chartStyle = {
  position: 'relative',
  height: '400px'
};

const chartData = computed(() => ({
  labels: Array.from(
    { length: props.channels[0]?.decimatedData.length || 0 }, 
    (_, i) => i
  ),
  datasets: props.channels.map(channel => ({
    label: channel.label,
    data: channel.decimatedData,
    fill: false,
    tension: 0.1,
    borderWidth: 1,
    pointRadius: 0
  }))
}));

const chartRef = ref<any>(null);

defineExpose({
  zoomTo(start: number, end: number) {
    if (!chartRef.value) return;
    
    const chart = chartRef.value.chart;

    // Устанавливаем новые границы по X
    chart.zoomScale('x', {
      min: start,
      max: end
    }, 'default');

    chart.update();
  },
  resetZoom() {
    if (!chartRef.value) return;
    chartRef.value.chart.resetZoom();
  }
});

// Добавляем маппинг типов событий
const EVENT_TYPE_MAP: Record<number, string> = {
  1: 'ds',
  2: 'is',
  3: 'swd'
};

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        generateLabels: (chart) => {
          // Получаем стандартные лейблы для каналов
          const defaultLabels = ChartJS.defaults.plugins.legend.labels?.generateLabels?.(chart) || [];
          
          // Добавляем лейблы для событий из аннотаций
          const eventLabels = props.annotations
            ?.filter(a => a.type === 'box') // Фильтруем только события (box аннотации)
            ?.reduce((acc: any[], annotation) => {
              // Получаем тип события из контента лейбла
              const eventType = parseInt(annotation.label?.content?.split(' ')[1] as string);
              const eventLabel = EVENT_TYPE_MAP[eventType] || `Событие ${eventType}`;
              
              // Проверяем, есть ли уже такой тип события в аккумуляторе
              const existingLabel = acc.find(l => l.text === eventLabel);
              
              if (!existingLabel) {
                acc.push({
                  text: eventLabel,
                  fillStyle: annotation.backgroundColor || 'rgba(0,0,0,0)',
                  strokeStyle: annotation.borderColor || '#000',
                  lineWidth: 1,
                  hidden: false,
                  isEvent: true,
                  eventType // сохраняем тип события для использования в onClick
                });
              }
              return acc;
            }, []) || [];

          return [...defaultLabels, ...eventLabels];
        },
        onClick: (e: any, legendItem: any, legend: any) => {
          const index = legendItem.datasetIndex;
          const ci = legend.chart;

          // Стандартное поведение для каналов данных
          if (ci.isDatasetVisible(index)) {
            ci.hide(index);
            legendItem.hidden = true;
          } else {
            ci.show(index);
            legendItem.hidden = false;
          }
        }
      }
    },
    title: {
      display: true,
      text: 'EDF Channels Data'
    },
    decimation: {
      enabled: true,
      algorithm: 'min-max'
    },
    colors: {
      enabled: true,
      forceOverride: true
    },
    zoom: {
      pan: {
        enabled: true,
        mode: 'x',
      },
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true
        },
        mode: 'x',
        limits: {
          x: {
            minRange: 10
          }
        }
      }
    },
    annotation: {
      annotations: props.annotations.reduce((acc, annotation, index) => {
        acc[`annotation${index}`] = annotation;
        return acc;
      }, {} as Record<string, any>)
    }
  },
  scales: {
    y: {
      beginAtZero: true
    },
    x: {
      ticks: {
        maxTicksLimit: 100
      }
    }
  }
}));
</script> 