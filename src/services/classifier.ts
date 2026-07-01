import type { Category } from "../types";
import { getCategoryUsageCopy, getSubscriptionUsageCopy } from "./transactionCopy";

interface Classification {
  category: Category;
  reason: string;
}

const rules: Array<{ category: Category; keywords: string[]; reason: string }> = [
  {
    category: "구독",
    keywords: ["넷플릭스", "유튜브", "스포티파이", "노션", "와우", "멤버십", "구독", "프리미엄"],
    reason: getCategoryUsageCopy("구독"),
  },
  {
    category: "카페/간식",
    keywords: ["스타벅스", "메가커피", "커피", "카페", "베이커리", "간식", "음료"],
    reason: getCategoryUsageCopy("카페/간식"),
  },
  {
    category: "교통",
    keywords: ["서울교통공사", "지하철", "버스", "택시", "따릉이", "교통", "이동"],
    reason: getCategoryUsageCopy("교통"),
  },
  {
    category: "식비",
    keywords: ["GS25", "이마트24", "학식", "맘스터치", "버거킹", "배달", "점심", "저녁", "야식", "식사"],
    reason: getCategoryUsageCopy("식비"),
  },
  {
    category: "쇼핑",
    keywords: ["무신사", "올리브영", "쿠팡", "화장품", "구매", "주문"],
    reason: getCategoryUsageCopy("쇼핑"),
  },
  {
    category: "생활",
    keywords: ["다이소", "생활용품", "생필품"],
    reason: getCategoryUsageCopy("생활"),
  },
  {
    category: "교육",
    keywords: ["교보문고", "전공", "참고서", "강의", "교육"],
    reason: getCategoryUsageCopy("교육"),
  },
  {
    category: "여가",
    keywords: ["CGV", "영화", "인생네컷", "모임", "여가"],
    reason: getCategoryUsageCopy("여가"),
  },
  {
    category: "의료",
    keywords: ["병원", "약국", "진료", "의료"],
    reason: getCategoryUsageCopy("의료"),
  },
];

export function classifyTransaction(merchant: string, memo: string, isSubscription: boolean): Classification {
  const haystack = `${merchant} ${memo}`.toLowerCase();

  if (isSubscription) {
    return {
      category: "구독",
      reason: getSubscriptionUsageCopy(merchant),
    };
  }

  const rule = rules.find((candidate) =>
    candidate.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  );

  if (rule) {
    return {
      category: rule.category,
      reason: rule.reason,
    };
  }

  return {
    category: "기타",
    reason: getCategoryUsageCopy("기타"),
  };
}
