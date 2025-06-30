import { Schema, model } from 'mongoose';

interface IShopItem {
  name: string;
  description: string;
  cost: number;
  createdAt: Date;
  googleFormLink: string;
}

const shopItemSchema = new Schema<IShopItem>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  cost: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  googleFormLink: { type: String, required: false },
});

export default model<IShopItem>('ShopItem', shopItemSchema);