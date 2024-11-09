import path from "path";
import {ProcessingTask} from "@/api/process/ProcessingTask";
import {ServiceResponse} from "@/common/models/serviceResponse";
import {handleServiceResponse} from "@/common/utils/httpHandlers";
import express, {type Request, type Response, type Router} from "express";
import fs from "node:fs/promises";
import {v4 as uuidv4} from "uuid";

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
        await new Promise((resolve) => {
            setTimeout(() => resolve(true), 5000);
        })

        processingTask.status = "completed";
        await processingTask.save();
    } catch (error) {
        console.error("Error processing file:", error);
        processingTask.status = "failed";
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

        const processingTask = new ProcessingTask({
            uid: fileId,
            date: new Date(),
            filename: uploadedFile.name,
            savedFilename: newFilename,
            filePath: filePath,
            status: 'pending'
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
