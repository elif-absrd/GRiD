import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../db';

interface SharedTokenAttributes {
  id: number;
  token: string;
  uid: string;
  createdAt: Date;
  expiresAt: Date;
}

interface SharedTokenCreationAttributes extends Optional<SharedTokenAttributes, 'id' | 'createdAt'> {}

class SharedToken extends Model<SharedTokenAttributes, SharedTokenCreationAttributes> implements SharedTokenAttributes {
  public id!: number;
  public token!: string;
  public uid!: string;
  public createdAt!: Date;
  public expiresAt!: Date;

  public readonly updatedAt!: Date;
}

SharedToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    uid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'SharedToken',
  }
);

export default SharedToken;
