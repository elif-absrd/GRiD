import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../db';

interface TaskAttributes {
  id: number;
  title: string;
  description: string;
  points: number;
  createdBy: string;
  createdAt: Date;
}

interface TaskCreationAttributes extends Optional<TaskAttributes, 'id' | 'createdAt'> {}

class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  public id!: number;
  public title!: string;
  public description!: string;
  public points!: number;
  public createdBy!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Task.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Task',
  }
);

export default Task;
