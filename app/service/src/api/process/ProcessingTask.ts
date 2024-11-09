import { Schema, model } from "mongoose";

interface IProcessingTask {
  uid: string;
  date: Date;
  filename: string;
  status: string;
  completedDate?: Date;
  filePath: string;
}

const processingTaskSchema = new Schema<IProcessingTask>({
  uid: { type: String, required: true },
  date: { type: Date, required: true },
  filename: { type: String, required: true },
  status: { type: String, required: true },
  completedDate: { type: Date, required: false },
  filePath: { type: String, required: true },
});

export const ProcessingTask = model<IProcessingTask>("ProcessingTask", processingTaskSchema);
