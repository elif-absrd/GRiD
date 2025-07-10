import sequelize from '../db';
import User from './User.pg';
import Task from './Task.pg';
import Submission from './Submission.pg';
import ShopItem from './ShopItem.pg';
import SharedToken from './sharedToken.pg';

// Define associations
User.hasMany(Submission, { foreignKey: 'userId' });
Task.hasMany(Submission, { foreignKey: 'taskId' });

Submission.belongsTo(User, { foreignKey: 'userId' });
Submission.belongsTo(Task, { foreignKey: 'taskId' });

// Function to sync all models with the database
export const syncDatabase = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connection has been established successfully.');
    
    await sequelize.sync({ force });
    console.log('All models were synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

export {
  User,
  Task,
  Submission,
  ShopItem,
  SharedToken,
};

export default sequelize;
