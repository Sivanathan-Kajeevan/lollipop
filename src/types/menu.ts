export type MenuScope = 'demo' | 'prod';

export type OrderStatus =
  | 'New'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Completed'
  | 'Cancelled';

export type PaymentStatus = 'Unpaid' | 'Paid';

export interface Category {
  id: number;
  scope: MenuScope;
  name: string;
  displayOrder: number;
  isVisible: boolean;
  foodCount?: number;
}

export interface FoodItem {
  id: number;
  scope: MenuScope;
  categoryId: number;
  categoryName?: string;
  name: string;
  description: string;
  priceLkr: number;
  imageUrl: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  isSpecial: boolean;
  displayOrder: number;
  updatedAt: string;
}

export interface RestaurantSettings {
  scope: MenuScope;
  restaurantName: string;
  logoUrl: string;
  logoIncludesName: boolean;
  welcomeMessage: string;
  whatsappNumber: string;
  address: string;
  openingHours: string;
  publicMenuUrl: string;
  providerName: string;
  providerLogoUrl: string;
  providerContact: string;
  providerWebsite: string;
}

export interface MenuStats {
  totalFoods: number;
  totalCategories: number;
  availableFoods: number;
  unavailableFoods: number;
  newOrders: number;
  activeOrders: number;
  completedOrders: number;
}

export interface PublicMenuPayload {
  settings: RestaurantSettings;
  categories: Category[];
  foods: FoodItem[];
}

export interface CartItem {
  foodId: number;
  name: string;
  unitPriceLkr: number;
  imageUrl: string;
  categoryName: string;
  quantity: number;
  note: string;
}

export interface OrderItemSnapshot {
  id: number;
  foodId: number | null;
  foodName: string;
  unitPriceLkr: number;
  quantity: number;
  lineTotalLkr: number;
  prepNote: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}

export interface CustomerOrderView {
  orderRef: string;
  customerToken: string;
  orderQrUrl: string;
  orderQrPngDataUrl: string;
  orderQrSvg: string;
  orderNotes: string;
  totalLkr: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  statusHistory: OrderStatusEvent[];
  createdAt: string;
  updatedAt: string;
  items: OrderItemSnapshot[];
  restaurantName: string;
  logoUrl: string;
  whatsappNumber: string;
}

export interface AdminOrderRecord {
  id: number;
  orderRef: string;
  customerToken: string;
  staffToken: string;
  customerName: string;
  customerPhoneDisplay: string;
  customerPhoneNormalized: string;
  orderNotes: string;
  totalLkr: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  statusHistory: OrderStatusEvent[];
  createdAt: string;
  updatedAt: string;
  items: OrderItemSnapshot[];
}

export interface OrderPriceChange {
  foodId: number;
  name: string;
  oldPriceLkr: number;
  newPriceLkr: number;
}

export interface LatestOrderReference {
  customerToken: string;
  orderRef: string;
  createdAt: string;
}
