import mongoose, { Types } from 'mongoose';

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://user1:OrKI7TFPCM1ERzJc@gridtest.0b6c4hc.mongodb.net/?retryWrites=true&w=majority&appName=GRiDtest');

// Interface for submission documents
interface ISubmission {
  _id: Types.ObjectId;
  taskId: string | Types.ObjectId;
}

async function migrateSubmissions(): Promise<void> {
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

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const submissions = (await db.collection('submissions').find().toArray()).map(doc => ({
      _id: doc._id as Types.ObjectId,
      taskId: doc.taskId as string | Types.ObjectId,
    })) as ISubmission[];

    console.log(`Found ${submissions.length} submissions to migrate`);

    for (const submission of submissions) {
      const taskId = submission.taskId;

      // Check if taskId is a string and not already an ObjectId
      if (typeof taskId === 'string') {
        if (!Types.ObjectId.isValid(taskId)) {
          console.error(`Invalid ObjectId for taskId: ${taskId} in submission ${submission._id}`);
          continue;
        }

        // Convert taskId to ObjectId
        const newTaskId = new Types.ObjectId(taskId);

        // Update the submission
        await db.collection('submissions').updateOne(
          { _id: submission._id },
          { $set: { taskId: newTaskId } }
        );

        console.log(`Updated submission ${submission._id}: taskId converted to ObjectId`);
      }
    }

    console.log('Migration completed');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.connection.close();
  }
}

migrateSubmissions();