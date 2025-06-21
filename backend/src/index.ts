import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import taskRoutes from './routes/tasks';
import shopRoutes from './routes/shop';
import leaderboardRoutes from './routes/leaderboard';
import dotenv from 'dotenv';
import User from './models/User';

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

// Middleware to verify Firebase token and sync user with MongoDB
app.use(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    console.log('No token provided in request headers');
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
    console.log('Token verified, decoded token:', { uid: decodedToken.uid, email: decodedToken.email });
  } catch (error: any) {
    console.error('Token verification failed:', error.code, error.message);
    res.status(401).json({ error: `Invalid token: ${error.message}` });
    return;
  }

  try {
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || 'Unknown';
    const isAdmin = decodedToken.admin || false; // Get admin status from token

    // Sync user with MongoDB
    let user = await User.findOne({ uid });
    if (!user) {
      user = new User({
        uid,
        name,
        email,
        points: 0,
        tokens: 0,
        admin: isAdmin, // Set admin field
      });
      await user.save();
      console.log(`Created user in MongoDB: ${email}`);
    } else {
      let updates: { email?: string; name?: string; admin?: boolean } = {};
      if (!user.email && email) updates.email = email;
      if (!user.name && name) updates.name = name;
      if (user.admin !== isAdmin) updates.admin = isAdmin; // Update admin field if changed
      if (Object.keys(updates).length > 0) {
        Object.assign(user, updates);
        await user.save();
        console.log(`Updated user ${uid}:`, updates);
      }
    }

    req.user = { uid, admin: isAdmin };
    next();
  } catch (error: any) {
    console.error('Database error during user sync:', error.code, error.message);
    res.status(500).json({ error: `Failed to sync user: ${error.message}` });
    return;
  }
});


// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.listen(3000, () => console.log('Server running on port 3000'));