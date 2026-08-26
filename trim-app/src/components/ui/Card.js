import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { radius, spacing } from '../../theme/spacing';

// The glassmorphism card recipe, tokenized: themed surface + subtle border + big
// radius. Replaces the repeated `rgba(255,255,255,0.05)` / `0.08` inline recipe.
function Card({ children, style, ...rest }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.card, borderColor: theme.border },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing(5), // 20
  },
});

export default Card;
