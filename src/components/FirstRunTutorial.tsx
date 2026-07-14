import { Bot, ChevronLeft, ChevronRight, Eye, ShieldCheck, WalletCards, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MoneyRoutineViewModel } from "../screens/screenTypes";
import type { TutorialStatus } from "../services/tutorial";
import type { TabId } from "../types";

interface TutorialStep {
  id: string;
  tab: TabId;
  target: string;
  title: string;
  description: string;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type FirstRunTutorialProps = MoneyRoutineViewModel & {
  enabled: boolean;
  onFinish: (status: Exclude<TutorialStatus, "pending">) => void;
};

const steps: TutorialStep[] = [
  {
    id: "home",
    tab: "home",
    target: "home-summary",
    title: "이번 달을 한눈에",
    description: "월 지출과 목표 진행률, 오늘 쓸 수 있는 금액을 먼저 확인해요.",
  },
  {
    id: "goal",
    tab: "home",
    target: "goal-button",
    title: "내 목표부터 설정",
    description: "수입과 소비·저축 목표를 바꾸면 모든 분석이 바로 다시 계산돼요.",
  },
  {
    id: "add",
    tab: "add",
    target: "add-entry",
    title: "소비 내역 추가",
    description: "직접 입력하거나 CSV를 연결하고, 항목은 자동 또는 직접 분류할 수 있어요.",
  },
  {
    id: "calendar",
    tab: "calendar",
    target: "calendar-main",
    title: "소비가 몰린 날 찾기",
    description: "날짜와 필터를 눌러 적정·초과·정기 결제 내역을 살펴봐요.",
  },
  {
    id: "coach",
    tab: "coach",
    target: "coach-overview",
    title: "AI 코치의 소비 가이드",
    description: "목표와 지난 소비 패턴을 바탕으로 오늘 한도와 분야별 계획을 보여줘요.",
  },
  {
    id: "ai",
    tab: "coach",
    target: "coach-ai-update",
    title: "AI는 원할 때만 호출",
    description: "이 버튼을 직접 눌렀을 때만 OpenAI 분석을 새로 받아요. 안내 중에는 호출하지 않아요.",
  },
  {
    id: "notifications",
    tab: "home",
    target: "notifications",
    title: "새 소비 알림 확인",
    description: "새 내역과 정기 결제 반영 소식을 알림에서 모아볼 수 있어요.",
  },
  {
    id: "settings",
    tab: "settings",
    target: "settings-tools",
    title: "데이터와 안내 관리",
    description: "샘플 불러오기, CSV 저장, 초기화와 사용 가이드 다시 보기를 할 수 있어요.",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function FirstRunTutorial({ actions, enabled, onFinish }: FirstRunTutorialProps) {
  const { loadSample: loadSampleData, setActiveTab } = actions;
  const [phase, setPhase] = useState<"welcome" | "tour">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<Record<string, number>>({});
  const layerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      layerRef.current?.querySelector<HTMLElement>("button")?.focus();
    }, 0);

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key !== "Tab" || !layerRef.current) {
        return;
      }

      const focusable = [...layerRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
    };
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled || phase !== "tour") {
      return;
    }

    setActiveTab(step.tab);
    let firstFrame = 0;
    let secondFrame = 0;

    function updatePosition() {
      const target = document.querySelector<HTMLElement>(`[data-tutorial="${step.target}"]`);
      if (!target) {
        setTargetRect(null);
        setTooltipStyle({});
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 6;
      const nextRect = {
        top: Math.max(6, rect.top - padding),
        left: Math.max(6, rect.left - padding),
        width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
        height: Math.min(window.innerHeight - 12, rect.height + padding * 2),
      };
      setTargetRect(nextRect);

      const margin = 14;
      const gap = 14;
      const tooltipWidth = Math.min(360, window.innerWidth - margin * 2);
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 230;
      let left = margin;
      let top = margin;

      if (window.innerWidth <= 640) {
        top = rect.top + rect.height / 2 > window.innerHeight / 2
          ? margin
          : window.innerHeight - tooltipHeight - margin;
      } else if (rect.right + gap + tooltipWidth <= window.innerWidth - margin) {
        left = rect.right + gap;
        top = clamp(rect.top, margin, window.innerHeight - tooltipHeight - margin);
      } else if (rect.left - gap - tooltipWidth >= margin) {
        left = rect.left - gap - tooltipWidth;
        top = clamp(rect.top, margin, window.innerHeight - tooltipHeight - margin);
      } else {
        left = clamp(rect.left, margin, window.innerWidth - tooltipWidth - margin);
        top = rect.bottom + gap + tooltipHeight <= window.innerHeight - margin
          ? rect.bottom + gap
          : Math.max(margin, rect.top - tooltipHeight - gap);
      }

      setTooltipStyle({ left, top, width: tooltipWidth });
    }

    firstFrame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-tutorial="${step.target}"]`);
      target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      secondFrame = window.requestAnimationFrame(updatePosition);
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [enabled, phase, setActiveTab, step]);

  if (!enabled) {
    return null;
  }

  function beginTour(shouldLoadSample: boolean) {
    if (shouldLoadSample) {
      loadSampleData();
    }
    setActiveTab("home");
    setStepIndex(0);
    setPhase("tour");
  }

  function finish(status: Exclude<TutorialStatus, "pending">) {
    setActiveTab("home");
    onFinish(status);
  }

  function moveStep(direction: -1 | 1) {
    const next = stepIndex + direction;
    if (next >= steps.length) {
      finish("completed");
      return;
    }
    setStepIndex(Math.max(0, next));
  }

  if (phase === "welcome") {
    return (
      <div className="tutorial-welcome-backdrop" ref={layerRef} data-testid="tutorial-welcome">
        <section className="tutorial-welcome" role="dialog" aria-modal="true" aria-labelledby="tutorial-welcome-title">
          <span className="tutorial-welcome-icon"><WalletCards size={25} /></span>
          <span className="tutorial-beta-label"><ShieldCheck size={14} /> 베타 체험 안내</span>
          <h2 id="tutorial-welcome-title">머니루틴을 시작해볼까요?</h2>
          <p>현재 베타 버전은 실제 은행·카드 앱과 연결하지 않아요. 체험용 임시 데이터로 안전하게 둘러볼 수 있어요.</p>
          <div className="tutorial-welcome-actions">
            <button className="primary-button" type="button" onClick={() => beginTour(true)} data-testid="tutorial-start-sample">
              <WalletCards size={18} /> 샘플로 둘러보기
            </button>
            <button className="secondary-button" type="button" onClick={() => beginTour(false)} data-testid="tutorial-start-features">
              <Eye size={18} /> 기능만 둘러보기
            </button>
          </div>
          <button className="tutorial-skip-link" type="button" onClick={() => finish("skipped")} data-testid="tutorial-skip-welcome">
            지금은 건너뛰기
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="tutorial-layer" ref={layerRef} data-testid="tutorial-tour">
      {targetRect && (
        <div
          className="tutorial-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          aria-hidden="true"
        />
      )}
      <section
        className="tutorial-tooltip"
        ref={tooltipRef}
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-step-title"
        data-testid={`tutorial-step-${step.id}`}
      >
        <div className="tutorial-tooltip-head">
          <span><Bot size={15} /> 사용 가이드</span>
          <button type="button" onClick={() => finish("skipped")} aria-label="가이드 건너뛰기" data-testid="tutorial-skip-tour">
            <X size={18} />
          </button>
        </div>
        <div className="tutorial-progress" aria-label={`${steps.length}단계 중 ${stepIndex + 1}단계`}>
          <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="tutorial-step-count">{stepIndex + 1} / {steps.length}</span>
        <h2 id="tutorial-step-title">{step.title}</h2>
        <p>{step.description}</p>
        <div className="tutorial-tooltip-actions">
          <button
            className="tutorial-back-button"
            type="button"
            onClick={() => moveStep(-1)}
            disabled={stepIndex === 0}
            aria-label="이전 안내"
            data-testid="tutorial-previous"
          >
            <ChevronLeft size={19} />
          </button>
          <button className="primary-button" type="button" onClick={() => moveStep(1)} data-testid="tutorial-next">
            {stepIndex === steps.length - 1 ? "시작하기" : "다음"}
            {stepIndex !== steps.length - 1 && <ChevronRight size={18} />}
          </button>
        </div>
      </section>
    </div>
  );
}
