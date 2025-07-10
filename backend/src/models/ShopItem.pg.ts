import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../db';

interface ShopItemAttributes {
  id: number;
  name: string;
  description: string;
  cost: number;
  createdAt: Date;
  googleFormLink?: string;
}

interface ShopItemCreationAttributes extends Optional<ShopItemAttributes, 'id' | 'createdAt'> {}

class ShopItem extends Model<ShopItemAttributes, ShopItemCreationAttributes> implements ShopItemAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public cost!: number;
  public googleFormLink?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ShopItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cost: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    googleFormLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ShopItem',
  }
);

export default ShopItem;
