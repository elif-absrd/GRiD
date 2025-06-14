import { Schema, model, Types } from 'mongoose';

interface ISubmission {
  taskId: Types.ObjectId;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
}

const submissionSchema = new Schema<ISubmission>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
});

submissionSchema.index({ taskId: 1, userId: 1 }, { unique: true });
export default model<ISubmission>('Submission', submissionSchema);