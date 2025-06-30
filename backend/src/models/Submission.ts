import { Schema, model, Types } from 'mongoose';

interface ISubmission {
  taskId: Types.ObjectId;
  userId: Types.ObjectId
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: Date;
  createdAt?: Date;
  mediaUrl?: string;
  declineReason?: string; 
}

const submissionSchema = new Schema<ISubmission>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  mediaUrl: { type: String, required: false },
  declineReason: { type: String },
});

submissionSchema.index({ taskId: 1, userId: 1 }, { unique: true });

export default model<ISubmission>('Submission', submissionSchema);
