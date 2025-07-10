import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';
import dotenv from 'dotenv';
import { User, syncDatabase } from './models';

dotenv.config();

// Initialize Firebase Admin with service account credentials
initializeApp({
  credential: cert(process.env.FIREBASE_CREDENTIALS_PATH!),
});

async function setAdmin(): Promise<void> {
  // Get the email from command line arguments
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address');
    process.exit(1);
  }

  try {
    await syncDatabase();
    console.log('Connected to PostgreSQL');

    // Find the user by email in Firebase
    const userRecord = await getAuth().getUserByEmail(email);
    console.log(`Found user: ${userRecord.uid}`);

    // Set admin claims in Firebase
    await getAuth().setCustomUserClaims(userRecord.uid, { admin: true });
    console.log(`Set admin claim for ${email} in Firebase`);

    // Update or create user in PostgreSQL
    const [user, created] = await User.findOrCreate({
      where: { uid: userRecord.uid },
      defaults: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || email.split('@')[0],
        points: 0,
        tokens: 0,
        admin: true
      }
    });

    if (!created) {
      await user.update({ admin: true });
    }
    
    console.log(`User ${email} has been set as admin in PostgreSQL`);
    process.exit(0);
  } catch (error) {
    console.error('Error setting admin:', error);
    process.exit(1);
  }
}

setAdmin();
