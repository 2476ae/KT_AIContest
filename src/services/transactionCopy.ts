import type { Category, Transaction } from "../types";

const categoryUsageCopy: Record<Category, string> = {
  식비: "식사나 배달에 돈을 사용했어요.",
  "카페/간식": "커피, 디저트, 간식에 돈을 사용했어요.",
  교통: "이동하는 데 돈을 사용했어요.",
  쇼핑: "필요한 물건을 사는 데 돈을 사용했어요.",
  여가: "문화나 여가 활동에 돈을 사용했어요.",
  구독: "정기 구독 결제금이 빠져나간 날이에요.",
  교육: "학습이나 교육에 돈을 사용했어요.",
  의료: "병원이나 약국에 돈을 사용했어요.",
  생활: "생활용품이나 일상 지출에 돈을 사용했어요.",
  기타: "기타 항목으로 돈을 사용했어요.",
};

export function getSubscriptionUsageCopy(merchant: string) {
  const serviceName = merchant.trim() || "서비스";
  return `구독 중인 ${serviceName} 결제금이 빠져나간 날이에요.`;
}

export function getCategoryUsageCopy(category: Category) {
  return categoryUsageCopy[category] ?? "소비 내역으로 기록했어요.";
}

export function getTransactionUsageCopy(transaction: Pick<Transaction, "category" | "isSubscription" | "merchant">) {
  if (transaction.isSubscription || transaction.category === "구독") {
    return getSubscriptionUsageCopy(transaction.merchant);
  }

  return getCategoryUsageCopy(transaction.category);
}

export function getManualCategoryCopy(category: Category) {
  return `${category} 항목으로 직접 기록했어요.`;
}

export function getLinkedCategoryCopy(category: Category) {
  return `${category} 항목으로 연결됐어요.`;
}
