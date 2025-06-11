import { Schema, model } from 'mongoose';

interface IUser {
  uid: string;
  email: string;
  points: number;
  tokens: number;
}

const userSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  points: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
});

export default model<IUser>('User', userSchema);