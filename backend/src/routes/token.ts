import express, { Request, Response } from 'express';
import crypto from 'crypto';
import SharedToken from '../models/sharedToken';
import { getAuth } from 'firebase-admin/auth';

// Define an interface for the request with the user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

const router = express.Router();

// Generate a shared access token (Admin only)
router.post('/generate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  try {
    const { uid, daysValid = 30 } = req.body;
    if (!uid) {
      res.status(400).json({ error: 'UID is required' });
      return;
    }

    // Verify that the UID exists in Firebase Auth
    await getAuth().getUser(uid);

    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysValid);

    const sharedToken = new SharedToken({
      token,
      uid,
      expiresAt,
    });

    await sharedToken.save();
    res.json({ token, expiresAt });
  } catch (error: any) {
    console.error('Error generating shared token:', error);
    res.status(500).json({ error: 'Failed to generate shared token' });
  }
});

// Login with a shared token
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    const sharedToken = await SharedToken.findOne({ token });
    if (!sharedToken) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (sharedToken.expiresAt < new Date()) {
      res.status(401).json({ error: 'Token has expired' });
      return;
    }

    // Generate a Firebase custom token for the UID
    const customToken = await getAuth().createCustomToken(sharedToken.uid);
    res.json({ customToken });
  } catch (error: any) {
    console.error('Error logging in with shared token:', error);
    res.status(500).json({ error: 'Failed to log in with shared token' });
  }
});

export default router;