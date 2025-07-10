import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../db';

interface UserAttributes {
  id: number;
  uid: string;
  name?: string;
  email?: string;
  points: number;
  tokens: number;
  admin: boolean;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public uid!: string;
  public name?: string;
  public email?: string;
  public points!: number;
  public tokens!: number;
  public admin!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    uid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    hooks: {
      beforeSave: (user: User) => {
        // Ensure tokens and points are never negative
        if (user.tokens < 0) {
          user.tokens = 0;
        }
        if (user.points < 0) {
          user.points = 0;
        }
      },
    },
  }
);

export default User;
