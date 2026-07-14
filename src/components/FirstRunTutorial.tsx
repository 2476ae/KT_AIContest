import { Bot, ChevronLeft, ChevronRight, ShieldCheck, WalletCards, X } from "lucide-react";
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
    title: "이번 달 소비를 한눈에",
    description: "샘플 내역으로 월 지출, 목표 진행률과 오늘 권장 한도를 먼저 확인해요.",
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
    description: "금액, 사용처와 날짜를 입력하고 항목은 자동 또는 직접 분류할 수 있어요.",
  },
  {
    id: "csv",
    tab: "add",
    target: "csv-import",
    title: "여러 내역은 CSV로 연결",
    description: "거래 파일을 미리 확인한 뒤 기존 내역을 교체하거나 안전하게 병합할 수 있어요.",
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
    id: "trust",
    tab: "home",
    target: "trust",
    title: "데이터 사용 범위 확인",
    description: "거래 저장 위치와 AI에 전달되는 정보 범위는 방패 버튼에서 확인할 수 있어요.",
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

function getFallbackTooltipStyle() {
  const margin = 14;
  return {
    bottom: margin,
    left: margin,
    width: Math.min(360, window.innerWidth - margin * 2),
  };
}

export function FirstRunTutorial({ actions, enabled, onFinish, state }: FirstRunTutorialProps) {
  const { loadSample: loadSampleData, setActiveTab } = actions;
  const hasTransactions = state.transactions.length > 0;
  const [phase, setPhase] = useState<"welcome" | "tour">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<Record<string, number>>(() => getFallbackTooltipStyle());
  const layerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    if (phase === "welcome") {
      document.body.style.overflow = "hidden";
    }
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
  }, [enabled, phase]);

  useLayoutEffect(() => {
    if (!enabled || phase !== "tour") {
      return;
    }

    if (state.activeTab !== step.tab) {
      setActiveTab(step.tab);
    }
  }, [enabled, phase, setActiveTab, state.activeTab, step.tab]);

  useLayoutEffect(() => {
    if (!enabled || phase !== "tour") {
      return;
    }

    let target: HTMLElement | null = null;
    let findFrame = 0;
    let measureFrame = 0;
    let findAttempts = 0;
    let resizeObserver: ResizeObserver | null = null;

    function updatePosition() {
      if (!target) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 6;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const margin = 14;
      const gap = 14;
      const tooltipWidth = Math.min(360, viewportWidth - margin * 2);
      const tooltipHeight = Math.min(tooltipRef.current?.offsetHeight ?? 230, viewportHeight - margin * 2);
      const spotlightLeft = clamp(rect.left - padding, 6, Math.max(6, viewportWidth - 7));
      const spotlightTop = clamp(rect.top - padding, 6, Math.max(6, viewportHeight - 7));
      const spotlightRight = clamp(rect.right + padding, spotlightLeft + 1, viewportWidth - 6);
      const mobileSpotlightHeight = Math.max(160, viewportHeight - tooltipHeight - margin * 2 - gap);
      const spotlightBottom = clamp(
        rect.bottom + padding,
        spotlightTop + 1,
        Math.min(viewportHeight - 6, spotlightTop + (viewportWidth <= 640 ? mobileSpotlightHeight : viewportHeight)),
      );
      const nextRect = {
        top: spotlightTop,
        left: spotlightLeft,
        width: spotlightRight - spotlightLeft,
        height: spotlightBottom - spotlightTop,
      };
      setTargetRect(nextRect);

      const targetBottom = nextRect.top + nextRect.height;
      const spaceAbove = nextRect.top - margin;
      const spaceBelow = viewportHeight - targetBottom - margin;
      let left = margin;
      let top = margin;

      if (viewportWidth <= 640) {
        if (spaceBelow >= tooltipHeight + gap) {
          top = targetBottom + gap;
        } else if (spaceAbove >= tooltipHeight + gap) {
          top = nextRect.top - tooltipHeight - gap;
        } else {
          top = spaceAbove >= spaceBelow ? margin : viewportHeight - tooltipHeight - margin;
        }
      } else if (nextRect.left + nextRect.width + gap + tooltipWidth <= viewportWidth - margin) {
        left = nextRect.left + nextRect.width + gap;
        top = clamp(nextRect.top, margin, viewportHeight - tooltipHeight - margin);
      } else if (nextRect.left - gap - tooltipWidth >= margin) {
        left = nextRect.left - gap - tooltipWidth;
        top = clamp(nextRect.top, margin, viewportHeight - tooltipHeight - margin);
      } else if (spaceBelow >= tooltipHeight + gap) {
        left = clamp(nextRect.left, margin, viewportWidth - tooltipWidth - margin);
        top = targetBottom + gap;
      } else {
        left = clamp(nextRect.left, margin, viewportWidth - tooltipWidth - margin);
        top = clamp(nextRect.top - tooltipHeight - gap, margin, viewportHeight - tooltipHeight - margin);
      }

      setTooltipStyle({
        left: clamp(left, margin, viewportWidth - tooltipWidth - margin),
        top: clamp(top, margin, viewportHeight - tooltipHeight - margin),
        width: tooltipWidth,
      });
    }

    function schedulePosition() {
      window.cancelAnimationFrame(measureFrame);
      measureFrame = window.requestAnimationFrame(updatePosition);
    }

    function scrollTargetIntoView() {
      if (!target) {
        return;
      }

      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (window.innerWidth > 640 || !tooltipRef.current) {
        target.scrollIntoView({ block: "center", inline: "nearest", behavior });
        return;
      }

      const margin = 14;
      const gap = 14;
      const targetRect = target.getBoundingClientRect();
      const tooltipHeight = Math.min(tooltipRef.current.offsetHeight, window.innerHeight - margin * 2);
      const desiredTargetTop = margin + tooltipHeight + gap + 6;
      const scrollRoot = document.scrollingElement ?? document.documentElement;
      const maxScrollTop = Math.max(0, scrollRoot.scrollHeight - window.innerHeight);
      const nextScrollTop = clamp(window.scrollY + targetRect.top - desiredTargetTop, 0, maxScrollTop);
      if (Math.abs(nextScrollTop - window.scrollY) > 1) {
        window.scrollTo({ top: nextScrollTop, behavior });
      }
    }

    function findTarget() {
      target = document.querySelector<HTMLElement>(`[data-tutorial="${step.target}"]`);
      if (!target) {
        findAttempts += 1;
        if (findAttempts < 60) {
          findFrame = window.requestAnimationFrame(findTarget);
        }
        return;
      }

      scrollTargetIntoView();
      measureFrame = window.requestAnimationFrame(() => {
        updatePosition();
        resizeObserver = new ResizeObserver(schedulePosition);
        resizeObserver.observe(target!);
        if (tooltipRef.current) {
          resizeObserver.observe(tooltipRef.current);
        }
      });
    }

    findFrame = window.requestAnimationFrame(findTarget);
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);

    return () => {
      window.cancelAnimationFrame(findFrame);
      window.cancelAnimationFrame(measureFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
    };
  }, [enabled, phase, step.id, step.target]);

  if (!enabled) {
    return null;
  }

  function beginTour() {
    if (!hasTransactions) {
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
          <h2 id="tutorial-welcome-title">머니루틴 사용법을 살펴볼까요?</h2>
          <p>
            베타 버전은 실제 은행·카드 앱과 연결하지 않아요. {hasTransactions
              ? "현재 저장된 내역을 유지한 채 주요 기능을 안내해요."
              : "체험용 임시 데이터로 주요 기능을 차례로 안내해요."}
          </p>
          <div className="tutorial-welcome-actions">
            <button className="primary-button" type="button" onClick={beginTour} data-testid="tutorial-start">
              <WalletCards size={18} /> 전체 기능 안내 시작
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
    <div className={`tutorial-layer${targetRect ? " is-ready" : ""}`} ref={layerRef} data-testid="tutorial-tour">
      {targetRect && (
        <div
          className="tutorial-spotlight"
          data-target={step.target}
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
        aria-live="polite"
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
            {stepIndex === steps.length - 1 ? "안내 마치기" : "다음"}
            {stepIndex !== steps.length - 1 && <ChevronRight size={18} />}
          </button>
        </div>
      </section>
    </div>
  );
}
