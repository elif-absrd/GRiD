import { Schema, model, Types } from 'mongoose';

interface ISubmission {
  taskId: Types.ObjectId;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: Date;
  createdAt?: Date;
}

const submissionSchema = new Schema<ISubmission>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default model<ISubmission>('Submission', submissionSchema);