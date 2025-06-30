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
import tokenRoutes from './routes/token';
import usersRoutes from './routes/users';

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

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    console.log('Token verified, decoded token:', { uid: decodedToken.uid, email: decodedToken.email, adminClaim: decodedToken.admin, customClaims: decodedToken, });

    const uid = decodedToken.uid;
    const email = decodedToken.email || 'Unknown';
    const name = decodedToken.name || email.split('@')[0] || 'Unknown';
    const isAdmin = decodedToken.admin === true; // Get admin status from token

    // Sync user with MongoDB
    let user = await User.findOne({ uid }).exec();
    if (!user) {
      user = new User({
        uid,
        name,
        email,
        points: 0,
        tokens: 0,
        admin: isAdmin,
      });
      await user.save();
      console.log(`Created user in MongoDB: ${email}`);
    } else {
      const updates: { email?: string; name?: string; admin?: boolean } = {};
      if (!user.email && email) updates.email = email;
      if (!user.name && name !== user.name) updates.name = name;
      if (user.admin !== isAdmin) updates.admin = isAdmin; // Update admin field if changed
      if (Object.keys(updates).length > 0) {
        Object.assign(user, updates);
        await user.save();
        console.log(`Updated user ${uid}:`, updates);
      }
    }

    req.user = { uid, admin: isAdmin };
    console.log('Request user:', req.user);
    next();
  } catch (error: any) {
    console.error('Error processing request:', error.code, error.message);
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({ error: 'Token expired. Please log in again.' });
    } else if (error.code === 'auth/too-many-requests') {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
    } else {
      res.status(500).json({ error: `Authentication failed: ${error.message}` });
    }
  }
});

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/users', usersRoutes);

// Removed incorrect app.use('/api/users', User) - should be a route handler, not the model
// If you need a users route, create a usersRoutes file and import it, e.g.:
// import usersRoutes from './routes/users';
// app.use('/api/users', usersRoutes);

app.listen(3000, () => console.log('Server running on port 3000'));