import express, { Router, Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import User from '../models/User';

const router: Router = express.Router();

router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.body.uid;
    if (!uid || typeof uid !== 'string') {
      res.status(400).json({ error: 'Invalid or missing UID' });
    }
    const firebaseUser = await getAuth().getUser(uid);
    const user = await User.findOne({ uid: firebaseUser.uid });
    if (!user) {
      await User.create({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || '',
        points: 0,
        tokens: 0,
        admin: firebaseUser.customClaims?.admin || false,
      });
    }
    res.status(200).json({ message: 'User synced' });
  } catch (error) {
    console.error('Error syncing user:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'auth/user-not-found') {
      res.status(404).json({ error: 'User not found in Firebase' });
    } else {
      res.status(500).json({ error: 'Failed to sync user' });
    }
  }
});

export default router;