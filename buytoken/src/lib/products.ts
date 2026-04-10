/**
 * 产品定义
 * 每个产品对应一种兑换码面额
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number; // 价格（分）
  redemptionValue: number; // 兑换码面值（元）
  stock: number; // 库存（-1 表示不限制）
}

export const PRODUCTS: Product[] = [
  {
    id: "token-0.01",
    name: "0.01元 Token 充值码",
    description: "可充值到 ClawOS Token 账户，抵扣 API 调用费用。面额 0.01 元，永久有效。",
    priceCents: 1,
    redemptionValue: 0.01,
    stock: -1,
  },
  {
    id: "token-10",
    name: "10元 Token 充值码",
    description: "可充值到 ClawOS Token 账户，抵扣 API 调用费用。面额 10 元，永久有效。",
    priceCents: 1000,
    redemptionValue: 10,
    stock: -1,
  },
  {
    id: "token-50",
    name: "50元 Token 充值码",
    description: "可充值到 ClawOS Token 账户，抵扣 API 调用费用。面额 50 元，永久有效。",
    priceCents: 4800,
    redemptionValue: 50,
    stock: -1,
  },
  {
    id: "token-100",
    name: "100元 Token 充值码",
    description: "可充值到 ClawOS Token 账户，抵扣 API 调用费用。面额 100 元，永久有效。",
    priceCents: 9500,
    redemptionValue: 100,
    stock: -1,
  },
  {
    id: "token-500",
    name: "500元 Token 充值码",
    description: "可充值到 ClawOS Token 账户，抵扣 API 调用费用。面额 500 元，永久有效。",
    priceCents: 45000,
    redemptionValue: 500,
    stock: -1,
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
