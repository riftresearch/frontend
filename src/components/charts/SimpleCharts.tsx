import React, { useEffect, useRef } from "react";
import { createChart, ColorType, HistogramSeries } from "lightweight-charts";
import { colors } from "@/utils/colors";

export const CumulativeVolumeChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.offWhite,
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        horzLine: { visible: true, color: colors.borderGray },
        vertLine: { visible: true, color: colors.borderGray },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
      },
      timeScale: {
        visible: true,
        borderVisible: false,
        timeVisible: true,
      },
    });

    // Generate mock data for cumulative volume
    const generateCumulativeVolumeData = () => {
      const data = [];
      let cumulativeVolume = 0;
      const baseDailyVolume = 21.23e9 / 30; // Daily volume from monthly

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        // Generate daily volume with variation
        const variation = Math.random() * 0.6 + 0.4; // 40% to 100% of base
        const dailyVolume = baseDailyVolume * variation;
        cumulativeVolume += dailyVolume;

        data.push({
          time: date.toISOString().split("T")[0],
          value: cumulativeVolume,
        });
      }

      return data;
    };

    // Create histogram series for cumulative volume (bar chart)
    const cumulativeVolumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.RiftBlue,
    });

    cumulativeVolumeSeries.setData(generateCumulativeVolumeData());

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div ref={chartContainerRef} style={{ width: "100%", height: "300px" }} />
  );
};

export const DailyVolumeChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.offWhite,
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        horzLine: { visible: true, color: colors.borderGray },
        vertLine: { visible: true, color: colors.borderGray },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
      },
      timeScale: {
        visible: true,
        borderVisible: false,
        timeVisible: true,
      },
    });

    // Generate mock data for daily volume
    const generateDailyVolumeData = () => {
      const data = [];
      const baseValue = 21.23e9 / 30; // Daily volume from monthly

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const variation = Math.random() * 0.6 + 0.4; // 40% to 100% of base
        const value = baseValue * variation;

        data.push({
          time: date.toISOString().split("T")[0],
          value: value,
        });
      }

      return data;
    };

    // Create histogram series using v5 API
    const histogramSeries = chart.addSeries(HistogramSeries, {
      color: colors.RiftOrange,
    });

    histogramSeries.setData(generateDailyVolumeData());

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div ref={chartContainerRef} style={{ width: "100%", height: "300px" }} />
  );
};
