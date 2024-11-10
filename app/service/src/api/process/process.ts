import path from "path";
import {ProcessingTask} from "@/api/process/ProcessingTask";
import {ServiceResponse} from "@/common/models/serviceResponse";
import {handleServiceResponse} from "@/common/utils/httpHandlers";
import express, {type Request, type Response, type Router} from "express";
import fs from "node:fs/promises";
import {v4 as uuidv4} from "uuid";
import fetch, {fileFromSync} from 'node-fetch';
import {env} from "@/common/utils/envConfig";
import {EDF} from "@/lib/edf";
import ExcelJS from 'exceljs';

export const processingRouter: Router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ensureUploadDir = async () => {
    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR, {recursive: true});
    }
};

const processUploadedFile = async (processingTask: any) => {
    try {
        const formData = new FormData();
        const fileStream = fileFromSync(processingTask.filePath);
        formData.append('file', fileStream);

        const res = await fetch(env.ML_SERVICE_URL + '/ml/catboost', {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        // res = {events: [{type: 1, time: {start: 1, end: 2}, confidence: 0.5}]}
        
        const data = await res.json() as {events: {type: number, time: {start: number, end: number}, confidence: number}[]};
        processingTask.events = data.events;
        processingTask.status = "completed";
        await processingTask.save();
    } catch (error) {
        console.error("Error processing file:", error);
        processingTask.status = "failed";
        await processingTask.save();
    } finally {
        processingTask.completedDate = new Date();
        await processingTask.save();
    }
};

processingRouter.post("/upload", async (_req: Request, res: Response) => {
    try {
        await ensureUploadDir();

        const fileId = uuidv4();
        const uploadedFile = (_req.files as any).file;
        const fileExtension = path.extname(uploadedFile.name);
        const newFilename = `${fileId}${fileExtension}`;
        const filePath = path.join(UPLOAD_DIR, newFilename);

        await fs.writeFile(filePath, uploadedFile.data);

        // Читаем EDF файл для получения его длительности
        const edf = new EDF(await fs.readFile(filePath));
        const decimatedData = decimateEDFData(edf, 400, 0, edf.duration);

        const processingTask = new ProcessingTask({
            uid: fileId,
            date: new Date(),
            filename: uploadedFile.name,
            savedFilename: newFilename,
            filePath: filePath,
            status: 'pending',
            decimatedData: decimatedData
        });

        await processingTask.save();

        // Запускаем обработку в фоновом режиме
        processUploadedFile(processingTask).catch(console.error);

        const serviceResponse = ServiceResponse.success("Task created successfully", processingTask);
        return handleServiceResponse(serviceResponse, res);
    } catch (error) {
        const serviceResponse = ServiceResponse.failure("Failed to upload file", null);
        return handleServiceResponse(serviceResponse, res);
    }
});

processingRouter.get("/tasks", async (_req: Request, res: Response) => {
    try {
        const tasks = await ProcessingTask.find().sort({date: -1}).limit(50);
        const serviceResponse = ServiceResponse.success("Tasks retrieved successfully", tasks);
        return handleServiceResponse(serviceResponse, res);
    } catch (error) {
        const serviceResponse = ServiceResponse.failure("Failed to retrieve tasks", null);
        return handleServiceResponse(serviceResponse, res);
    }
});

processingRouter.get("/tasks/:uid", async (req: Request, res: Response) => {
    try {
        const task = await ProcessingTask.findOne({uid: req.params.uid});

        if (!task) {
            const serviceResponse = ServiceResponse.failure("Task not found", null, 404);
            return handleServiceResponse(serviceResponse, res);
        }

        const serviceResponse = ServiceResponse.success("Task retrieved successfully", task);
        return handleServiceResponse(serviceResponse, res);
    } catch (error) {
        const serviceResponse = ServiceResponse.failure("Failed to retrieve task", null);
        return handleServiceResponse(serviceResponse, res);
    }
});

processingRouter.get("/data/:uid", async (req: Request, res: Response) => {
    const task = await ProcessingTask.findOne({uid: req.params.uid});
    if (!task) {
        const serviceResponse = ServiceResponse.failure("Task not found", null, 404);
        return handleServiceResponse(serviceResponse, res);
    }

    // Получаем параметры из query с значениями по умолчанию
    const decimationFactor = parseInt(req.query.factor as string) || 400;
    const startTime = parseInt(req.query.start as string) || 0;

    const edf = new EDF(await fs.readFile(task.filePath));
    const endTime = parseInt(req.query.end as string) || edf.duration; // 6 часов по умолчанию

    const decimatedData = decimateEDFData(edf, decimationFactor, startTime, endTime);
    const serviceResponse = ServiceResponse.success("Data retrieved successfully", decimatedData);
    return handleServiceResponse(serviceResponse, res);
});

processingRouter.get("/export/:uid", async (req: Request, res: Response) => {
    try {
        const task = await ProcessingTask.findOne({uid: req.params.uid});
        
        if (!task) {
            const serviceResponse = ServiceResponse.failure("Задача не найдена", null, 404);
            return handleServiceResponse(serviceResponse, res);
        }

        if (!task.events || task.events.length === 0) {
            const serviceResponse = ServiceResponse.failure("Нет событий для экспорта", null, 404);
            return handleServiceResponse(serviceResponse, res);
        }

        // Создаем новую рабочую книгу и лист
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Анализ событий');

        // Добавляем заголовки
        worksheet.columns = [
            { header: 'Тип события', key: 'type', width: 15 },
            { header: 'Время начала (с)', key: 'startTime', width: 15 },
            { header: 'Время окончания (с)', key: 'endTime', width: 15 },
            { header: 'Длительность (с)', key: 'duration', width: 15 },
            { header: 'Достоверность', key: 'confidence', width: 15 }
        ];

        // Добавляем строки данных
        task.events.forEach(event => {
            worksheet.addRow({
                type: getEventTypeName(event.type),
                startTime: event.time.start.toFixed(2),
                endTime: event.time.end.toFixed(2),
                duration: (event.time.end - event.time.start).toFixed(2),
                confidence: (event.confidence * 100).toFixed(1) + '%'
            });
        });

        // Стилизуем строку заголовка
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Добавляем сводную статистику
        worksheet.addRow([]); // Пустая строка для разделения
        worksheet.addRow(['Сводная статистика']);
        worksheet.addRow(['Всего событий:', task.events.length]);
        
        const avgConfidence = task.events.reduce((sum, event) => sum + event.confidence, 0) / task.events.length;
        worksheet.addRow(['Средняя достоверность:', (avgConfidence * 100).toFixed(1) + '%']);

        // Устанавливаем заголовки ответа
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=analysis_${task.uid}.xlsx`
        );

        // Записываем в поток ответа
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Ошибка экспорта в Excel:", error);
        const serviceResponse = ServiceResponse.failure("Не удалось экспортировать данные", null);
        return handleServiceResponse(serviceResponse, res);
    }
});

// Вспомогательная функция для преобразования числовых типов событий в читаемые названия
function getEventTypeName(type: number): string {
    const eventTypes: Record<number, string> = {
        1: 'ds',
        2: 'is',
        3: 'swd',
    };
    return eventTypes[type] || `Неизвестный тип ${type}`;
}

function decimateEDFData(edf: EDF, decimationFactor: number, startTime: number, endTime: number) {
    const result = [];
    
    for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
        const channelData = edf.readSingleChannel(channelIndex, startTime, endTime - startTime);
        const chunks = [];
        
        // Разбиваем данные на чанки и вычисляем среднее
        for (let i = 0; i < channelData.length; i += decimationFactor) {
            const chunk = channelData.slice(i, i + decimationFactor);
            const average = chunk.reduce((sum, val) => sum + val, 0) / chunk.length;
            chunks.push(average);
        }

        result.push({
            label: edf.channels[channelIndex].label,
            decimatedData: chunks
        });
    }
    
    return result;
}

