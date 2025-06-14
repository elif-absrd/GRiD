import mongoose from 'mongoose';
import Task from '../src/models/Task';
import Submission from '../src/models/Submission';
import User from '../src/models/User';

// Ensure models are registered by importing them
console.log('Registering models...');
console.log('Task model:', Task ? 'Loaded' : 'Not loaded');
console.log('Submission model:', Submission ? 'Loaded' : 'Not loaded');
console.log('User model:', User ? 'Loaded' : 'Not loaded');

// Define interfaces for type safety
interface ITask {
  _id: string;
  title: string;
  description: string;
  points: number;
  createdBy: string;
  createdAt?: Date;
}

interface ISubmission {
  _id: string;
  taskId: ITask; // taskId will be populated as an ITask object
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: Date;
  createdAt?: Date;
}

interface IUser {
  _id: string;
  uid: string;
  email: string;
  name: string;
  points: number;
  tokens: number;
}

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://user1:OrKI7TFPCM1ERzJc@gridtest.0b6c4hc.mongodb.net/?retryWrites=true&w=majority&appName=GRiDtest');

async function recalculatePoints(): Promise<void> {
  try {
    // Wait for the connection to be established
    await new Promise<void>((resolve, reject) => {
      mongoose.connection.once('open', () => {
        console.log('Connected to MongoDB');
        resolve();
      });
      mongoose.connection.once('error', (err) => {
        console.error('Connection error:', err);
        reject(err);
      });
    });

    // Fetch all users as plain objects and cast to IUser[]
    const rawUsers = await User.find().lean();
    const users: IUser[] = rawUsers.map((user: any) => ({
      ...user,
      _id: user._id.toString(),
    }));
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      // Fetch all approved submissions for this user as plain objects and cast to ISubmission[]
      const rawSubmissions = await Submission.find({ userId: user.uid, status: 'approved' })
        .populate('taskId')
        .lean();

      const submissions: ISubmission[] = rawSubmissions.map((submission: any) => ({
        ...submission,
        _id: submission._id.toString(),
        taskId: submission.taskId && typeof submission.taskId === 'object'
          ? { ...submission.taskId, _id: submission.taskId._id.toString() }
          : submission.taskId,
      }));
      console.log(`User ${user.uid}: Found ${submissions.length} approved submissions`);

      // Calculate total points
      let totalPoints = 0;
      for (const submission of submissions) {
        if (submission.taskId && submission.taskId.points) {
          console.log(`Submission ${submission._id}: Task "${submission.taskId.title}" - Points: ${submission.taskId.points}`);
          totalPoints += submission.taskId.points;
        } else {
          console.log(`Submission ${submission._id}: Task not found or no points`);
        }
      }

      console.log(`User ${user.uid}: Total points from submissions: ${totalPoints}`);

      // Update user points and tokens
      const updateResult = await User.updateOne(
        { uid: user.uid },
        { points: totalPoints, tokens: totalPoints }
      );

      if (updateResult.matchedCount === 0) {
        console.error(`User ${user.uid} not found during update`);
      } else {
        console.log(`Updated user ${user.uid}: Points set to ${totalPoints}`);
      }
    }

    console.log('Points recalculation completed');
  } catch (error) {
    console.error('Error recalculating points:', error);
  } finally {
    await mongoose.connection.close();
  }
}

recalculatePoints();