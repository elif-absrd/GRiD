import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import taskRoutes from './routes/tasks';
import shopRoutes from './routes/shop';
import leaderboardRoutes from './routes/leaderboard';
import User from './models/User'; // Import User model
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Initialize Firebase Admin with service account credentials
initializeApp({
  credential: cert(process.env.FIREBASE_CREDENTIALS_PATH!),
});

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskApp';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

// Define an interface for the request with the user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

// Middleware to verify Firebase token and ensure user exists in MongoDB
app.use(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;

    // Ensure the user exists in MongoDB
    let dbUser = await User.findOne({ uid: decodedToken.uid });
    if (!dbUser) {
      dbUser = new User({
        uid: decodedToken.uid,
        email: decodedToken.email, // Store the email
        points: 0,
        tokens: 100, // For testing
      });
      await dbUser.save();
      console.log(`Created new user in MongoDB: ${decodedToken.uid}`);
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
});

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.listen(3000, () => console.log('Server running on port 3000'));