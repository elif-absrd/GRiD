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

UserSchema.pre('save', function(this: IUser, next) {
  // Ensure tokens and points are never negative
  if (this.tokens < 0) {
    this.tokens = 0;
  }
  if (this.points < 0) {
    this.points = 0;
  }
  next();
});

export default mongoose.model<IUser>('User', UserSchema);