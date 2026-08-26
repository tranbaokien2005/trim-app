import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import { radius, typography } from '../../theme/spacing';

// A single Button primitive to replace the ~20 ad-hoc button re-implementations.
// Variants map to ROLE, not to screen:
//   primary   → solid accent fill        (the main CTA)
//   secondary → outlined accent          (alternative / recessed action)
//   ghost     → text only, no chrome     (low-emphasis)
function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  ...rest
}) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const container = {
    primary: { backgroundColor: theme.accent, borderColor: theme.accent },
    secondary: { backgroundColor: 'transparent', borderColor: theme.accent },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }[variant];

  const labelColor = {
    primary: theme.accentText,
    secondary: theme.accent,
    ghost: theme.accent,
  }[variant];

  return (
    <TouchableOpacity
      style={[styles.base, container, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: { ...typography.subtitle, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});

export default Button;
