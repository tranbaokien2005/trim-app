// Spacing, radius, and typography scales.
// These are theme-independent (same in light & dark) so they live outside the
// palette and can be imported directly by any StyleSheet.

// 4pt base grid. spacing(1)=4, spacing(2)=8, spacing(3)=12, spacing(4)=16,
// spacing(5)=20, spacing(6)=24, spacing(7)=28, spacing(8)=32.
export const spacing = (n) => n * 4;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  card: 28, // glassmorphism cards (design system canon)
  pill: 999,
};

// Typography ramp — collapses the ad-hoc 28/26/24/.../10 sizes into named roles.
export const typography = {
  display: { fontSize: 28, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
};
