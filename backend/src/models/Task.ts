import { Schema, model } from 'mongoose';

interface ITask {
  title: string;
  description: string;
  points: number;
  createdBy: string;
  createdAt: Date;
}

const taskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  points: { type: Number, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model<ITask>('Task', taskSchema);