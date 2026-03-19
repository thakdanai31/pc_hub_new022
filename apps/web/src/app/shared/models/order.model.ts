export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderItemDetail {
  id: number;
  productId: number;
  productSnapshot: {
    name: string;
    sku: string;
    warrantyMonths: number | null;
    categoryName: string;
    brandName: string;
    image: string | null;
  };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PaymentSlipInfo {
  id: number;
  imageUrl: string;
  uploadedAt: string;
}

export interface PaymentInfo {
  id: number;
  paymentMethod: string;
  status: string;
  amount: number;
  rejectReason: string | null;
  reviewedAt: string | null;
  slips: PaymentSlipInfo[];
}

export interface OrderDetail {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  addressSnapshot: Record<string, string>;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  customerNote: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  items: OrderItemDetail[];
  payment: PaymentInfo | null;
}

export interface PromptPayQR {
  qrDataUrl: string;
  amount: number;
  promptPayId: string;
  orderNumber: string;
}

export interface SlipUploadResult {
  imageUrl: string;
  uploadedAt: string;
}
