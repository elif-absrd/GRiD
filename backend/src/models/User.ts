import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  uid: string;
  name?: string;
  email: string;
  points: number;
  tokens: number;
  admin?: boolean; // Add the admin property
}

const UserSchema: Schema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String, required: true },
  points: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
  admin: { type: Boolean, default: false } // Add the admin field to schema
});

export default mongoose.model<IUser>('User', UserSchema);