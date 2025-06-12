import { useState, useEffect } from "react";

type WindowState =
  | { isLoaded: false; width: number; height: number } // Default dimensions for SSR
  | { isLoaded: true; width: number; height: number }; // Actual browser dimensions

const useWindowSize = () => {
  const [windowState, setWindowState] = useState<WindowState>({
    isLoaded: false,
    width: 1920, // Sensible default for SSR
    height: 1080,
  });

  const { width, height, isLoaded } = windowState;

  const isLargeDesktop = width > 1920;
  const isLaptop = width <= 1920;
  const isSmallLaptop = width < 1200;
  const isTablet = width < 1000;
  const isSmallTablet = width < 700;
  const isMobile = width < 600;
  const isSmallMobile = width < 440;

  const isMonoScroll = isTablet;

  const contentWidth = isSmallTablet ? "100%" : "80%";

  const scaleToSize = <T>(
    isLargeDesktopSize: T,
    isLaptopSize: T,
    isSmallLaptopSize: T,
    isTabletSize: T,
    isSmallTabletSize: T,
    isMobileSize: T
  ) => {
    if (isMobile) return isMobileSize;
    if (isSmallTablet) return isSmallTabletSize;
    if (isTablet) return isTabletSize;
    if (isSmallLaptop) return isSmallLaptopSize;
    if (isLaptop) return isLaptopSize;
    else return isLargeDesktopSize;
  };

  const scaleFontSize = <T>(
    isLargeDesktopSize: T,
    isLaptopSize: T,
    isTabletSize: T
  ) => {
    if (isLargeDesktop) return isLargeDesktopSize;
    if (isLaptop) return isLaptopSize;
    else return isTabletSize;
  };

  const standardFontSize = scaleFontSize("1.2rem", "1.1rem", "1rem");

  useEffect(() => {
    const handleResize = () => {
      setWindowState({
        isLoaded: true,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    isWindowValid: isLoaded, // Renamed for clarity
    windowSize: { width, height },
    scaleToSize,
    scaleFontSize,
    isLargeDesktop,
    isLaptop,
    isSmallLaptop,
    isTablet,
    isSmallTablet,
    isMobile,
    isSmallMobile,
    contentWidth,
    standardFontSize,
    isMonoScroll,
  };
};

export default useWindowSize;
