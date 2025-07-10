import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { syncDatabase, User, Task, Submission, ShopItem, SharedToken } from '../src/models';

dotenv.config();

// Define MongoDB interfaces
interface MongoUser {
  _id: string;
  uid: string;
  name?: string;
  email?: string;
  points: number;
  tokens: number;
  admin?: boolean;
}

interface MongoTask {
  _id: string;
  title: string;
  description: string;
  points: number;
  createdBy: string;
  createdAt: Date;
}

interface MongoSubmission {
  _id: string;
  taskId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  mediaUrl?: string;
  declineReason?: string;
}

interface MongoShopItem {
  _id: string;
  name: string;
  description: string;
  cost: number;
  createdAt: Date;
  googleFormLink?: string;
}

interface MongoSharedToken {
  _id: string;
  token: string;
  uid: string;
  createdAt: Date;
  expiresAt: Date;
}

async function migrateData(): Promise<void> {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Connect to PostgreSQL
    await syncDatabase();
    console.log('Connected to PostgreSQL');
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Failed to get MongoDB database connection');
    }
    
    // Migrate Users
    console.log('Migrating Users...');
    const mongoUsers = await db.collection('users').find({}).toArray() as any[];
    const userMap = new Map<string, number>(); // Map MongoDB _id to PostgreSQL id
    
    for (const mongoUser of mongoUsers) {
      const pgUser = await User.create({
        uid: mongoUser.uid,
        name: mongoUser.name || null,
        email: mongoUser.email || null,
        points: mongoUser.points || 0,
        tokens: mongoUser.tokens || 0,
        admin: mongoUser.admin || false
      });
      userMap.set(mongoUser._id.toString(), pgUser.id);
      console.log(`Migrated user: ${mongoUser.uid}`);
    }
    console.log(`${mongoUsers.length} users migrated`);
    
    // Migrate Tasks
    console.log('Migrating Tasks...');
    const mongoTasks = await db.collection('tasks').find({}).toArray() as any[];
    const taskMap = new Map<string, number>(); // Map MongoDB _id to PostgreSQL id
    
    for (const mongoTask of mongoTasks) {
      const pgTask = await Task.create({
        title: mongoTask.title,
        description: mongoTask.description,
        points: mongoTask.points,
        createdBy: mongoTask.createdBy,
        createdAt: mongoTask.createdAt
      });
      taskMap.set(mongoTask._id.toString(), pgTask.id);
      console.log(`Migrated task: ${mongoTask.title}`);
    }
    console.log(`${mongoTasks.length} tasks migrated`);
    
    // Migrate Submissions
    console.log('Migrating Submissions...');
    const mongoSubmissions = await db.collection('submissions').find({}).toArray() as any[];
    
    for (const mongoSubmission of mongoSubmissions) {
      const mongoUserId = mongoSubmission.userId.toString();
      const mongoTaskId = mongoSubmission.taskId.toString();
      
      const pgUserId = userMap.get(mongoUserId);
      const pgTaskId = taskMap.get(mongoTaskId);
      
      if (pgUserId && pgTaskId) {
        await Submission.create({
          userId: pgUserId,
          taskId: pgTaskId,
          status: mongoSubmission.status,
          submittedAt: mongoSubmission.submittedAt,
          mediaUrl: mongoSubmission.mediaUrl,
          declineReason: mongoSubmission.declineReason
        });
        console.log(`Migrated submission for user ${pgUserId}, task ${pgTaskId}`);
      } else {
        console.log(`Could not migrate submission: User ID ${mongoUserId} or Task ID ${mongoTaskId} not found`);
      }
    }
    console.log(`${mongoSubmissions.length} submissions migrated`);
    
    // Migrate ShopItems
    console.log('Migrating Shop Items...');
    const mongoShopItems = await db.collection('shopitems').find({}).toArray() as any[];
    
    for (const mongoShopItem of mongoShopItems) {
      await ShopItem.create({
        name: mongoShopItem.name,
        description: mongoShopItem.description,
        cost: mongoShopItem.cost,
        createdAt: mongoShopItem.createdAt,
        googleFormLink: mongoShopItem.googleFormLink
      });
      console.log(`Migrated shop item: ${mongoShopItem.name}`);
    }
    console.log(`${mongoShopItems.length} shop items migrated`);
    
    // Migrate Shared Tokens
    console.log('Migrating Shared Tokens...');
    const mongoSharedTokens = await db.collection('sharedtokens').find({}).toArray() as any[];
    
    for (const mongoSharedToken of mongoSharedTokens) {
      await SharedToken.create({
        token: mongoSharedToken.token,
        uid: mongoSharedToken.uid,
        createdAt: mongoSharedToken.createdAt,
        expiresAt: mongoSharedToken.expiresAt
      });
      console.log(`Migrated shared token for user ${mongoSharedToken.uid}`);
    }
    console.log(`${mongoSharedTokens.length} shared tokens migrated`);
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
