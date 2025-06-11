import { Schema, model } from 'mongoose';

interface ISubmission {
  taskId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
}

const submissionSchema = new Schema<ISubmission>({
  taskId: { type: String, required: true },
  userId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
});

export default model<ISubmission>('Submission', submissionSchema);