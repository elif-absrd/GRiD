import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  uid: string;
  name?: string;
  email?: string;
  points: number;
  tokens: number;
  admin?: boolean; // Added admin field
}

const UserSchema: Schema = new Schema({
  uid: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  email: { type: String, unique: true, sparse: true },
  points: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
  admin: { type: Boolean, default: false }, // Default to false for non-admins
});

export default mongoose.model<IUser>('User', UserSchema);