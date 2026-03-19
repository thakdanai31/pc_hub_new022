export interface CartProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  image: string | null;
  category: { id: number; name: string; slug: string; isActive: boolean };
  brand: { id: number; name: string; slug: string; isActive: boolean };
}

export interface CartItem {
  id: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: CartProduct;
}

export interface Cart {
  id: number;
  items: CartItem[];
}

export interface OrderConfirmation {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  createdAt: string;
}

export interface CheckoutInvalidItem {
  cartItemId: number | null;
  productId: number;
  productName: string;
  reason: string;
}
