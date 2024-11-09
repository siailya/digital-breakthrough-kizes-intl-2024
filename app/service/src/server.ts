import {healthCheckRouter} from "@/api/healthCheck/healthCheckRouter";
import {processingRouter} from "@/api/process/process";
import errorHandler from "@/common/middleware/errorHandler";
import {env} from "@/common/utils/envConfig";
import cors from "cors";
import express, {type Express} from "express";
import fileUpload from "express-fileupload";
import mongoose from "mongoose";

const app: Express = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

mongoose.connect(env.MONGODB).then(() => console.log('Mongoose connected'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors({origin: env.CORS_ORIGIN, credentials: true}));
app.use(fileUpload());

// Routes
app.use("/api/health-check", healthCheckRouter);
app.use("/api/processing", processingRouter);

// Error handlers
app.use(errorHandler());

export {app};
