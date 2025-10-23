import React, { forwardRef } from "react";
import { Box, Flex, FlexProps } from "@chakra-ui/react";

interface GridFlexProps
  extends Omit<
    FlexProps,
    "w" | "h" | "width" | "height" | "bg" | "background" | "backgroundImage"
  > {
  /** Number of grid blocks wide. If provided, overrides width props. */
  widthBlocks?: number;
  /** Number of grid blocks tall. If provided, overrides height props. */
  heightBlocks?: number;
  /** Pixel size of a single grid block. Defaults to 80. */
  blockSize?: number;
  /** Inner padding applied inside the border, defaults to 20 (px). */
  contentPadding?: number | string;
  /** Whether to render the grid background. Defaults to true. */
  showGrid?: boolean;
  /** Optional explicit width when not using widthBlocks */
  width?: FlexProps["width"];
  w?: FlexProps["w"];
  /** Optional explicit height when not using heightBlocks */
  height?: FlexProps["height"];
  h?: FlexProps["h"];
}

export const GridFlex = forwardRef<HTMLDivElement, GridFlexProps>(
  (
    {
      children,
      widthBlocks,
      heightBlocks,
      blockSize = 45,
      contentPadding = 0,
      showGrid = true,
      ...flexProps
    },
    ref
  ) => {
    const GRID_FLEX_COLORS = {
      background: "#090909",
      gridLine: "#191919",
      borderGradient: "linear-gradient(to bottom, #242424 0%, #4E4E4E 56%, #252525 100%)",
    } as const;
    const borderRadiusPx = 30; // px
    const borderWidthPx = 2; // px
    const lineWidth = 1; // grid line thickness in px

    const computedWidth =
      typeof widthBlocks === "number"
        ? `${widthBlocks * blockSize}px`
        : (flexProps as any).width || (flexProps as any).w;

    const computedHeight =
      typeof heightBlocks === "number"
        ? `${heightBlocks * blockSize}px`
        : (flexProps as any).height || (flexProps as any).h;

    // GridFlex color constants (easy to tweak in one place)

    // Grid made of two repeating gradients (vertical + horizontal)
    const gridBackground = `
      repeating-linear-gradient(
        to right,
        transparent,
        transparent ${blockSize - lineWidth}px,
        ${GRID_FLEX_COLORS.gridLine} ${blockSize - lineWidth}px,
        ${GRID_FLEX_COLORS.gridLine} ${blockSize}px
      ),
      repeating-linear-gradient(
        to bottom,
        transparent,
        transparent ${blockSize - lineWidth}px,
        ${GRID_FLEX_COLORS.gridLine} ${blockSize - lineWidth}px,
        ${GRID_FLEX_COLORS.gridLine} ${blockSize}px
      )
    `;

    // Offset the grid by half a block in both directions so lines start centered in a cell
    const gridBackgroundPosition = `${blockSize / 2}px 0, 0 ${blockSize / 2}px`;

    // Normalize shorthand alignment props (left/right/top/bottom → flex-start/end)
    const normalizeAlign = (value?: string): "flex-start" | "center" | "flex-end" | undefined => {
      if (!value) return undefined;
      const v = value.toLowerCase();
      if (v === "left" || v === "top" || v === "start" || v === "flex-start") return "flex-start";
      if (v === "right" || v === "bottom" || v === "end" || v === "flex-end") return "flex-end";
      if (v === "center") return "center";
      return undefined;
    };

    const anyProps = flexProps as any;
    const contentAlignItems = normalizeAlign(anyProps.alignItems || anyProps.align) || "flex-start";
    const contentJustify =
      normalizeAlign(anyProps.justifyContent || anyProps.justify) || "flex-start";

    return (
      <Flex
        ref={ref}
        position="relative"
        border={`${borderWidthPx}px solid transparent`}
        borderRadius={`${borderRadiusPx}px`}
        style={{
          background: `linear-gradient(${GRID_FLEX_COLORS.background}, ${GRID_FLEX_COLORS.background}) padding-box, ${GRID_FLEX_COLORS.borderGradient} border-box`,
        }}
        overflow="hidden"
        w={computedWidth || "auto"}
        h={computedHeight || "auto"}
        // Ensure outer wrapper doesn't re-center children
        alignItems="stretch"
        justifyContent="stretch"
        {...flexProps}
      >
        {showGrid && (
          <Box
            position="absolute"
            inset={0}
            backgroundImage={gridBackground}
            backgroundSize={`${blockSize}px ${blockSize}px, ${blockSize}px ${blockSize}px`}
            backgroundPosition={gridBackgroundPosition}
            pointerEvents="none"
          />
        )}

        {/* Gradient fade applied only over grid lines (not content). */}
        {showGrid && (
          <Box
            position="absolute"
            inset={0}
            pointerEvents="none"
            // Transparent at bottom, fades to background at top
            style={{
              background:
                "linear-gradient(to bottom, rgba(9,9,9,0.85) 0%, rgba(9,9,9,0.0) 20%, rgba(9,9,9,0.0) 100%)",
              mixBlendMode: "multiply",
            }}
          />
        )}

        <Flex
          position="relative"
          zIndex={1}
          w="100%"
          h="100%"
          p={contentPadding}
          alignItems={contentAlignItems}
          justifyContent={contentJustify}
        >
          {children}
        </Flex>
      </Flex>
    );
  }
);

GridFlex.displayName = "GridFlex";
