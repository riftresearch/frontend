import { useEffect, useState } from "react";
import { Box, Text } from "@chakra-ui/react";
import { useStore } from "@/utils/store";

interface CountdownTimerProps {
  onComplete?: () => void;
}

export function CountdownTimer({ onComplete }: CountdownTimerProps) {
  const countdownValue = useStore((state) => state.countdownValue);
  const setCountdownValue = useStore((state) => state.setCountdownValue);
  const depositFlowState = useStore((state) => state.depositFlowState);
  const [smoothProgress, setSmoothProgress] = useState(100);
  const [isAnimatingToZero, setIsAnimatingToZero] = useState(false);
  const [previousState, setPreviousState] = useState("0-not-started");
  const [showTimer, setShowTimer] = useState(false);
  const [hideNumber, setHideNumber] = useState(false);
  const [initialCountdownValue, setInitialCountdownValue] = useState(99); // Track the starting value

  useEffect(() => {
    // Reset progress only when starting fresh from state 0
    if (depositFlowState === "1-WaitingUserDepositInitiated" && previousState === "0-not-started") {
      // Capture the initial countdown value for progress calculations
      setInitialCountdownValue(countdownValue);
      // Trigger entrance animation
      setShowTimer(true);
      setHideNumber(false); // Reset number visibility
      setSmoothProgress(100);
    }

    // Show timer for any active state
    if (depositFlowState !== "0-not-started") {
      setShowTimer(true);
    } else {
      setShowTimer(false);
    }

    setPreviousState(depositFlowState);
  }, [depositFlowState, previousState]);

  useEffect(() => {
    // Only run countdown if we're in an active state and countdown > 0
    if (depositFlowState === "0-not-started" || countdownValue <= 0) {
      if (countdownValue <= 0) {
        onComplete?.();
      }
      return;
    }

    // Continue countdown
    const interval = setInterval(() => {
      if (countdownValue <= 1) {
        // Will trigger onComplete in the next cycle
        setCountdownValue(0);
      } else {
        setCountdownValue(countdownValue - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownValue, setCountdownValue, onComplete, depositFlowState]);

  // Smooth progress animation
  useEffect(() => {
    const targetProgress = countdownValue <= 0 ? 0 : (countdownValue / initialCountdownValue) * 100;
    const startProgress =
      countdownValue <= 0
        ? (1 / initialCountdownValue) * 100 // Start from 1 when going to 0
        : ((countdownValue + 1) / initialCountdownValue) * 100;
    const startTime = Date.now();

    // Mark that we're animating to zero
    if (countdownValue <= 0) {
      setIsAnimatingToZero(true);
    }

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const duration = 1000; // 1 second
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentProgress = startProgress - (startProgress - targetProgress) * easeProgress;

      setSmoothProgress(currentProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (countdownValue <= 0) {
        // Animation to zero is complete
        setIsAnimatingToZero(false);
        // Delay the number fade-out slightly after circle disappears
        setTimeout(() => {
          setHideNumber(true);
        }, 200);
      }
    };

    requestAnimationFrame(animate);
  }, [countdownValue]);

  // Calculate circle properties - arc from 12 o'clock (2.5x bigger, then 80% twice)
  const radius = 45 * 2.5 * 0.8 * 0.8; // 72 (90 * 0.8)
  const circumference = 2 * Math.PI * radius;
  const arcLength = (smoothProgress / 100) * circumference;
  const strokeDasharray = `${arcLength} ${circumference}`;
  const strokeDashoffset = -((100 - smoothProgress) / 100) * circumference; // Offset to make it shrink clockwise

  return (
    <Box
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
      opacity={showTimer ? 1 : 0}
      transform={showTimer ? "translateY(0px)" : "translateY(30px)"}
      transition="all 1.2s cubic-bezier(0.16, 1, 0.3, 1)"
      transitionDelay={showTimer ? "0.3s" : "0s"}
    >
      {/* SVG Circle Progress - 80% of 80% of 2.5x size */}
      <svg width="192" height="192" style={{ transform: "rotate(-90deg)" }}>
        {/* Progress circle - show when there's progress or animating to 0 */}
        {(smoothProgress > 0 || isAnimatingToZero) && (
          <circle
            cx="96"
            cy="96"
            r={radius}
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
          />
        )}
        {/* Gradient definition - top to bottom */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7062A9" />
            <stop offset="100%" stopColor="#6267A9" />
          </linearGradient>
        </defs>
      </svg>

      {/* Countdown number */}
      <Text
        position="absolute"
        fontSize={countdownValue > 99 ? "68px" : "88px"}
        textAlign="center"
        letterSpacing={countdownValue > 99 ? "-10px" : "-13px"}
        mt="-5px"
        ml={countdownValue > 99 ? "-12px" : countdownValue > 9 ? "-16px" : "-16px"}
        color="white"
        dropShadow="0 0 100px rgba(255, 255, 255, 0.5)"
        fontFamily="Proto Mono"
        opacity={hideNumber ? 0 : 1}
        transform={hideNumber ? "translateY(30px)" : "translateY(0px)"}
        transition="all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      >
        {countdownValue}
      </Text>
    </Box>
  );
}
