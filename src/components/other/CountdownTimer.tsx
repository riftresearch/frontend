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

  useEffect(() => {
    // Reset progress only when starting fresh from state 0
    if (
      depositFlowState === "1-finding-liquidity" &&
      previousState === "0-not-started" &&
      countdownValue === 10
    ) {
      setSmoothProgress(100);
      const interval = setInterval(() => {
        setCountdownValue(countdownValue - 1);
      }, 1000);

      return () => clearInterval(interval);
    }
    setPreviousState(depositFlowState);
  }, [depositFlowState, countdownValue, setCountdownValue, previousState]);

  useEffect(() => {
    // Handle countdown completion
    if (countdownValue <= 0) {
      // Don't immediately set progress to 0, let the animation handle it
      onComplete?.();
      return;
    }

    // Continue countdown
    const interval = setInterval(() => {
      setCountdownValue(countdownValue - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownValue, setCountdownValue, onComplete]);

  // Smooth progress animation
  useEffect(() => {
    const targetProgress =
      countdownValue <= 0 ? 0 : (countdownValue / 10) * 100;
    const startProgress =
      countdownValue <= 0
        ? (1 / 10) * 100 // Start from 1 when going to 0
        : ((countdownValue + 1) / 10) * 100;
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
      const currentProgress =
        startProgress - (startProgress - targetProgress) * easeProgress;

      setSmoothProgress(currentProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (countdownValue <= 0) {
        // Animation to zero is complete
        setIsAnimatingToZero(false);
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

      {/* Countdown number - 2.5x bigger */}
      <Text
        position="absolute"
        fontSize="88px"
        letterSpacing="-16px"
        mt="-5px"
        ml={countdownValue > 9 ? "-21px" : "-16px"}
        color="white"
        dropShadow="0 0 100px rgba(255, 255, 255, 0.5)"
        fontFamily="Proto Mono"
      >
        {countdownValue}
      </Text>
    </Box>
  );
}
