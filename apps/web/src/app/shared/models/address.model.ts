export interface Address {
  id: number;
  userId: number;
  label: string;
  recipientName: string;
  phoneNumber: string;
  line1: string;
  line2: string | null;
  district: string;
  subdistrict: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressPayload {
  label: string;
  recipientName: string;
  phoneNumber: string;
  line1: string;
  line2?: string;
  district: string;
  subdistrict: string;
  province: string;
  postalCode: string;
  isDefault?: boolean;
}

export type UpdateAddressPayload = Partial<CreateAddressPayload>;
