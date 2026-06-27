// React Theme — extracted from https://beauty.hotpepper.jp
// Compatible with: Chakra UI, Stitches, Vanilla Extract, or any CSS-in-JS

/**
 * TypeScript type definition for this theme:
 *
 * interface Theme {
 *   colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    neutral50: string;
    neutral100: string;
    neutral200: string;
    neutral300: string;
    neutral400: string;
    neutral500: string;
    neutral600: string;
    neutral700: string;
    neutral800: string;
    neutral900: string;
 *   };
 *   fonts: {
    body: string;
 *   };
 *   fontSizes: {
    '0': string;
    '10': string;
    '11': string;
    '12': string;
    '13': string;
    '14': string;
    '16': string;
 *   };
 *   space: {
    '1': string;
    '18': string;
    '20': string;
    '22': string;
    '25': string;
    '28': string;
    '30': string;
    '32': string;
    '37': string;
    '40': string;
    '140': string;
    '208': string;
 *   };
 *   radii: {
    xs: string;
    sm: string;
 *   };
 *   shadows: {

 *   };
 *   states: {
 *     hover: { opacity: number };
 *     focus: { opacity: number };
 *     active: { opacity: number };
 *     disabled: { opacity: number };
 *   };
 * }
 */

export const theme = {
  "colors": {
    "primary": "#0f94d2",
    "secondary": "#e25983",
    "accent": "#dcd6d2",
    "background": "#fdfdf5",
    "foreground": "#000000",
    "neutral50": "#4c4c80",
    "neutral100": "#333333",
    "neutral200": "#000000",
    "neutral300": "#444444",
    "neutral400": "#ffffff",
    "neutral500": "#666666",
    "neutral600": "#595959",
    "neutral700": "#999999",
    "neutral800": "#cdcdcd",
    "neutral900": "#bfb4ab"
  },
  "fonts": {
    "body": "'lucida grande', sans-serif"
  },
  "fontSizes": {
    "0": "0px",
    "10": "10px",
    "11": "11px",
    "12": "12px",
    "13": "13px",
    "14": "14px",
    "16": "16px"
  },
  "space": {
    "1": "1px",
    "18": "18px",
    "20": "20px",
    "22": "22px",
    "25": "25px",
    "28": "28px",
    "30": "30px",
    "32": "32px",
    "37": "37px",
    "40": "40px",
    "140": "140px",
    "208": "208px"
  },
  "radii": {
    "xs": "2px",
    "sm": "5px"
  },
  "shadows": {},
  "states": {
    "hover": {
      "opacity": 0.08
    },
    "focus": {
      "opacity": 0.12
    },
    "active": {
      "opacity": 0.16
    },
    "disabled": {
      "opacity": 0.38
    }
  }
};

// MUI v5 theme
export const muiTheme = {
  "palette": {
    "primary": {
      "main": "#0f94d2",
      "light": "hsl(199, 87%, 59%)",
      "dark": "hsl(199, 87%, 29%)"
    },
    "secondary": {
      "main": "#e25983",
      "light": "hsl(342, 70%, 77%)",
      "dark": "hsl(342, 70%, 47%)"
    },
    "background": {
      "default": "#fdfdf5",
      "paper": "#bfb4ab"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#333333"
    }
  },
  "typography": {
    "fontFamily": "'Times', sans-serif",
    "body1": {
      "fontSize": "16px",
      "fontWeight": "400",
      "lineHeight": "normal"
    },
    "body2": {
      "fontSize": "10px",
      "fontWeight": "400",
      "lineHeight": "15px"
    }
  },
  "shape": {
    "borderRadius": 2
  },
  "shadows": []
};

export default theme;
