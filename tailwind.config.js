import forms from '@tailwindcss/forms';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-secondary": "#ffffff",
        "primary-fixed-dim": "#c8c6c5",
        "surface-variant": "#e2e2e2",
        "outline": "#747878",
        "primary": "#000000",
        "secondary": "#5f5e5c",
        "surface-container": "#eeeeee",
        "background": "#f9f9f9",
        "on-surface": "#1a1c1c",
        "surface": "#f9f9f9",
        "outline-variant": "#c4c7c7",
      },
      spacing: {
        "gutter": "16px",
        "stack-md": "40px",
        "stack-lg": "80px",
        "margin-desktop": "64px",
        "stack-sm": "24px",
        "unit": "4px",
        "margin-mobile": "20px"
      },
      fontFamily: {
        "display-lg-mobile": ["Hanken Grotesk"],
        "body-md": ["Hanken Grotesk"],
        "headline-md": ["Hanken Grotesk"],
        "label-caps": ["Hanken Grotesk"],
        "body-lg": ["Hanken Grotesk"],
        "display-lg": ["Hanken Grotesk"]
      },
      fontSize: {
        "display-lg-mobile": ["36px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "300" }],
        "body-md": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "headline-md": ["24px", { "lineHeight": "1.2", "letterSpacing": "0.05em", "fontWeight": "500" }],
        "label-caps": ["11px", { "lineHeight": "1.2", "letterSpacing": "0.15em", "fontWeight": "700" }],
        "body-lg": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
        "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "300" }]
      }
    }
  },
  plugins: [
    forms,
  ],
}
