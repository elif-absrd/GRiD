import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
initializeApp({
  credential: cert(process.env.FIREBASE_CREDENTIALS_PATH!),
});

async function setAdminClaim(email: string) {
  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Admin claim set for user: ${email}`);
  } catch (error) {
    console.error('Error setting admin claim:', error);
  }
}

// Replace with the email of the user you want to make an admin
setAdminClaim('lunawatvinay8@gmail.com').then(() => process.exit());