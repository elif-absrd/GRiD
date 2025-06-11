import { Schema, model } from 'mongoose';

interface IShopItem {
  name: string;
  description: string;
  tokenCost: number;
}

const shopItemSchema = new Schema<IShopItem>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  tokenCost: { type: Number, required: true },
});

export default model<IShopItem>('ShopItem', shopItemSchema);