import { createSystem, defaultConfig } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

const fonts = { mono: `'Menlo', monospace` };

const theme = createSystem(defaultConfig, {
  theme: {
    tokens: {
      fonts: {
        mono: { value: FONT_FAMILIES.AUX_MONO },
        body: { value: FONT_FAMILIES.NOSTROMO },
        heading: { value: FONT_FAMILIES.NOSTROMO },
      },
    },
    recipes: {
      box: {
        variants: {
          project: {
            "&:hover .overlay": {
              opacity: 0.5,
            },
            "&:hover .text": {
              opacity: 1,
            },
          },
        },
      },
    },
  },
  globalCss: {
    "html, body": {
      backgroundColor: "#020202",
      fontFamily: FONT_FAMILIES.NOSTROMO,
      color: colors.offWhite,
    },
    text: {
      fontFamily: FONT_FAMILIES.NOSTROMO,
      color: colors.offWhite,
    },
  },
});

export default theme;
