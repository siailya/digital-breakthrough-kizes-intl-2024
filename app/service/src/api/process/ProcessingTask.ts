import { Schema, model } from "mongoose";

interface IProcessingTask {
  uid: string;
  date: Date;
  filename: string;
  status: string;
  completedDate?: Date;
  filePath: string;
  events?: {type: number, time: {start: number, end: number}, confidence: number}[];
  decimatedData?: {label: string, decimatedData: number[]}[];
}

const processingTaskSchema = new Schema<IProcessingTask>({
  uid: { type: String, required: true },
  date: { type: Date, required: true },
  filename: { type: String, required: true },
  status: { type: String, required: true },
  completedDate: { type: Date, required: false },
  filePath: { type: String, required: true },
  events: { type: Array, required: false },
  decimatedData: { type: Array, required: false },
});

export const ProcessingTask = model<IProcessingTask>("ProcessingTask", processingTaskSchema);
