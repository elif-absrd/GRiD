import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../db';
import User from './User.pg';
import Task from './Task.pg';

interface SubmissionAttributes {
  id: number;
  taskId: number;
  userId: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  mediaUrl?: string;
  declineReason?: string;
}

interface SubmissionCreationAttributes extends Optional<SubmissionAttributes, 'id' | 'submittedAt'> {}

class Submission extends Model<SubmissionAttributes, SubmissionCreationAttributes> implements SubmissionAttributes {
  public id!: number;
  public taskId!: number;
  public userId!: number;
  public status!: 'pending' | 'approved' | 'rejected';
  public submittedAt!: Date;
  public mediaUrl?: string;
  public declineReason?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Submission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.INTEGER,
      references: {
        model: Task,
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    submittedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    declineReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Submission',
    indexes: [
      {
        unique: true,
        fields: ['taskId', 'userId'],
      },
    ],
  }
);

// Define associations
Submission.belongsTo(Task, { foreignKey: 'taskId' });
Submission.belongsTo(User, { foreignKey: 'userId' });
Task.hasMany(Submission, { foreignKey: 'taskId' });
User.hasMany(Submission, { foreignKey: 'userId' });

export default Submission;
