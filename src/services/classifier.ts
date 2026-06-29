import type { Category } from "../types";

interface Classification {
  category: Category;
  reason: string;
}

const rules: Array<{ category: Category; keywords: string[]; reason: string }> = [
  {
    category: "구독",
    keywords: ["넷플릭스", "유튜브", "스포티파이", "노션", "와우", "멤버십", "구독", "프리미엄"],
    reason: "정기 결제 또는 월 구독으로 보이는 사용처입니다.",
  },
  {
    category: "카페/간식",
    keywords: ["스타벅스", "메가커피", "커피", "카페", "베이커리", "간식", "음료"],
    reason: "커피, 디저트, 간식성 소비로 분류했습니다.",
  },
  {
    category: "교통",
    keywords: ["서울교통공사", "지하철", "버스", "택시", "따릉이", "교통", "이동"],
    reason: "대중교통 또는 이동 비용으로 분류했습니다.",
  },
  {
    category: "식비",
    keywords: ["GS25", "이마트24", "학식", "맘스터치", "버거킹", "배달", "점심", "저녁", "야식", "식사"],
    reason: "식사나 배달 소비로 분류했습니다.",
  },
  {
    category: "쇼핑",
    keywords: ["무신사", "올리브영", "쿠팡", "화장품", "구매", "주문"],
    reason: "상품 구매성 소비로 분류했습니다.",
  },
  {
    category: "생활",
    keywords: ["다이소", "생활용품", "생필품"],
    reason: "생활 유지에 필요한 지출로 분류했습니다.",
  },
  {
    category: "교육",
    keywords: ["교보문고", "전공", "참고서", "강의", "교육"],
    reason: "학습과 교육 관련 소비로 분류했습니다.",
  },
  {
    category: "여가",
    keywords: ["CGV", "영화", "인생네컷", "모임", "여가"],
    reason: "문화/여가 활동 비용으로 분류했습니다.",
  },
  {
    category: "의료",
    keywords: ["병원", "약국", "진료", "의료"],
    reason: "의료 관련 지출로 분류했습니다.",
  },
];

export function classifyTransaction(merchant: string, memo: string, isSubscription: boolean): Classification {
  const haystack = `${merchant} ${memo}`.toLowerCase();

  if (isSubscription) {
    return {
      category: "구독",
      reason: "거래가 구독 결제로 표시되어 있습니다.",
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
    reason: "명확한 분류 단서가 적어 기타로 두었습니다.",
  };
}
