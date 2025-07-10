import { Task, User, Submission, syncDatabase } from '../models';
import { Op } from 'sequelize';

async function recalculatePoints(): Promise<void> {
  try {
    await syncDatabase();
    console.log('Connected to PostgreSQL');

    // Fetch all users
    const users = await User.findAll();
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      // Fetch all approved submissions for this user
      const submissions = await Submission.findAll({
        where: { 
          userId: user.id, 
          status: 'approved' 
        },
        include: [{
          model: Task,
          attributes: ['points']
        }]
      });

      // Calculate total points
      const totalPoints = submissions.reduce((sum, submission) => {
        const taskPoints = submission.Task?.points || 0;
        return sum + taskPoints;
      }, 0);

      console.log(`User ${user.uid} has ${submissions.length} approved submissions, total points: ${totalPoints}`);

      // Update user with new points
      await user.update({ points: totalPoints });
      console.log(`Updated user ${user.uid}: Points set to ${totalPoints}`);
    }

    console.log('Points recalculation completed');
    process.exit(0);
  } catch (error) {
    console.error('Error recalculating points:', error);
    process.exit(1);
  }
}

recalculatePoints();
