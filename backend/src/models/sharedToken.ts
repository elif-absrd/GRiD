import { Schema, model } from 'mongoose';

interface ISharedToken {
  token: string;
  uid: string;
  createdAt: Date;
  expiresAt: Date;
}

const sharedTokenSchema = new Schema<ISharedToken>({
  token: { type: String, required: true, unique: true },
  uid: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

export default model<ISharedToken>('SharedToken', sharedTokenSchema);