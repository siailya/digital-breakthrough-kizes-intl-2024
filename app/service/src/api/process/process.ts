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
