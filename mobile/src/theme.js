// theme.js
// Converted from OKLCH values defined in stitch_minimal_image_unlock_login/pixel_vault/DESIGN.md

export const colors = {
  bgDark: '#e5e8ca',
  bg: '#f2f5d7',
  bgLight: '#ffffe4',
  text: '#0d0c00',
  textMuted: '#494c0f',
  highlight: '#ffffc7',
  border: '#81854b',
  borderMuted: '#9fa469',
  primary: '#4a4c00',
  secondary: '#4a3b78',
  danger: '#8b5148',
  warning: '#6e6429',
  success: '#357153',
  info: '#486491',
};

export const typography = {
  fontFamily: {
    regular: 'HankenGrotesk_400Regular',
    medium: 'HankenGrotesk_500Medium',
    semiBold: 'HankenGrotesk_600SemiBold',
    bold: 'HankenGrotesk_700Bold',
  },
  fontSize: {
    xs: 12,
    sm: 14, // label-md
    md: 16, // body-md, button
    lg: 18, // body-lg
    xl: 24, // headline-md
    xxl: 28, // headline-lg-mobile
    xxxl: 32, // headline-lg
    hero: 40, // headline-xl
  },
  lineHeight: {
    tight: 1, // button
    snug: 1.2, // headlines
    normal: 1.4, // label-md
    relaxed: 1.6, // body
  }
};

export const spacing = {
  xs: 4,
  base: 8,
  sm: 12,
  md: 24,
  lg: 48,
  xl: 80,
  gutter: 24,
  marginMobile: 16,
  marginDesktop: 64,
};

export const radii = {
  sm: 4,     // 0.25rem
  base: 8,   // 0.5rem (Standard Radius)
  md: 12,    // 0.75rem
  lg: 16,    // 1rem (Component Radius)
  xl: 24,    // 1.5rem
  pill: 9999, // Status badges
};
