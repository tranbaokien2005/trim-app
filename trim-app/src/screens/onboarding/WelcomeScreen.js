import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Static data ─────────────────────────────────────────────────────────────

const PARTICLES = [
  { left: 40,  top: 180, size: 4, dur: 2500 },
  { left: 320, top: 140, size: 3, dur: 3000 },
  { left: 60,  top: 420, size: 5, dur: 2800 },
  { left: 340, top: 380, size: 4, dur: 3200 },
  { left: 80,  top: 620, size: 6, dur: 2600 },
  { left: 300, top: 580, size: 3, dur: 3400 },
];

// Each ring grows from base 220 to these pixel sizes.
// Stored as scale factors (220 × factor = target px).
const RING_MAX_SCALES = [280 / 220, 290 / 220, 300 / 220];
const RING_DELAYS     = [0, 600, 1200]; // ms stagger between rings

// ─── Component ───────────────────────────────────────────────────────────────

const WelcomeScreen = ({ navigation }) => {
  // Entrance animation values
  const logoOpacity      = useRef(new Animated.Value(0)).current;
  const logoScale        = useRef(new Animated.Value(0.7)).current;
  const titleOpacity     = useRef(new Animated.Value(0)).current;
  const titleTranslateY  = useRef(new Animated.Value(20)).current;
  const taglineOpacity   = useRef(new Animated.Value(0)).current;
  const buttonOpacity    = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;

  // Loop animation values — initialized at 1 so rings start invisible
  // (progress=1 → opacity interpolates to 0) until loops fire after entrance.
  const ringProgresses = useRef(RING_MAX_SCALES.map(() => new Animated.Value(1))).current;
  const particleYs     = useRef(PARTICLES.map(() => new Animated.Value(0))).current;
  const particleOps    = useRef(PARTICLES.map(() => new Animated.Value(0.15))).current;
  const breathScale    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const easing  = Easing.out(Easing.cubic);
    const timers   = [];
    const loopAnims = [];
    let mounted    = true;

    // ── Entrance ────────────────────────────────────────────────────────────
    const entrance = Animated.parallel([
      // 1. Logo: fade + scale up
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, easing, useNativeDriver: true }),
        Animated.timing(logoScale,   { toValue: 1, duration: 600, easing, useNativeDriver: true }),
      ]),
      // 2. Title: slide up + fade, delay 300ms
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(titleOpacity,    { toValue: 1, duration: 500, easing, useNativeDriver: true }),
          Animated.timing(titleTranslateY, { toValue: 0, duration: 500, easing, useNativeDriver: true }),
        ]),
      ]),
      // 3. Tagline + dots: fade, delay 500ms
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, easing, useNativeDriver: true }),
      ]),
      // 4. Button: slide up + fade, delay 700ms
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(buttonOpacity,    { toValue: 1, duration: 500, easing, useNativeDriver: true }),
          Animated.timing(buttonTranslateY, { toValue: 0, duration: 500, easing, useNativeDriver: true }),
        ]),
      ]),
    ]);

    entrance.start(() => {
      if (!mounted) return;

      // ── Effect 1: Pulse rings ──────────────────────────────────────────────
      RING_MAX_SCALES.forEach((_, i) => {
        const t = setTimeout(() => {
          if (!mounted) return;
          // Reset to 0 so loop starts from the "ring at rest" state
          ringProgresses[i].setValue(0);
          const anim = Animated.loop(
            Animated.timing(ringProgresses[i], {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            })
          );
          anim.start();
          loopAnims.push(anim);
        }, RING_DELAYS[i]);
        timers.push(t);
      });

      // ── Effect 2: Floating particles ──────────────────────────────────────
      PARTICLES.forEach((p, i) => {
        const half = p.dur / 2;
        const t = setTimeout(() => {
          if (!mounted) return;
          const yAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(particleYs[i], { toValue: -12, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(particleYs[i], { toValue: 0,   duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          );
          const opAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(particleOps[i], { toValue: 0.35, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(particleOps[i], { toValue: 0.15, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          );
          yAnim.start();
          opAnim.start();
          loopAnims.push(yAnim, opAnim);
        }, i * 250); // stagger each particle 250ms apart
        timers.push(t);
      });

      // ── Effect 3: Logo breathing ───────────────────────────────────────────
      const breathAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScale, { toValue: 1.03, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breathScale, { toValue: 1.0,  duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      breathAnim.start();
      loopAnims.push(breathAnim);
    });

    return () => {
      mounted = false;
      entrance.stop();
      timers.forEach(clearTimeout);
      loopAnims.forEach((a) => a.stop());
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Layer 1 — floating particles (sit below SafeAreaView content) */}
      {PARTICLES.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: '#2ECC71',
            opacity: particleOps[i],
            transform: [{ translateY: particleYs[i] }],
          }}
        />
      ))}

      {/* Layer 2 — main screen content */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.top}>

          {/* Logo area — entrance wrapper carries opacity + scale for the whole group */}
          <Animated.View
            style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          >
            {/* Pulse rings rendered first so they sit behind glow + image */}
            {ringProgresses.map((progress, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    opacity: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [{
                      scale: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, RING_MAX_SCALES[i]],
                        extrapolate: 'clamp',
                      }),
                    }],
                  },
                ]}
              />
            ))}

            {/* Soft green glow disc */}
            <View style={styles.logoGlow} />

            {/* Logo image — wrapped in its own View so breathing doesn't
                affect the rings or glow disc */}
            <Animated.View style={{ transform: [{ scale: breathScale }] }}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>

          <Animated.Text
            style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}
          >
            Trim
          </Animated.Text>

          <Animated.View style={[styles.taglineGroup, { opacity: taglineOpacity }]}>
            <Text style={styles.tagline}>Less logging. More results.</Text>
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </Animated.View>

          <View style={styles.spacer} />
        </View>

        <Animated.View
          style={[styles.buttonWrap, { opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] }]}
        >
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Disclaimer')}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  safeArea: {
    flex: 1,
  },
  top: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: SCREEN_HEIGHT * 0.18,
  },

  // 220×220 container — rings + glow + image all share this center point
  logoWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Base ring shape; scale + opacity driven by interpolated progress
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: '#2ECC71',
  },

  logoGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#2ECC71',
    opacity: 0.07,
    shadowColor: '#2ECC71',
    shadowRadius: 60,
    shadowOpacity: 0.3,
  },
  logo: {
    width: 200,
    height: 200,
  },

  title: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginTop: 24,
  },
  taglineGroup: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 15,
    color: '#555555',
    marginTop: 10,
  },
  dots: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
  },
  dotActive: {
    backgroundColor: '#2ECC71',
  },
  spacer: {
    flex: 1,
    maxHeight: 80,
  },
  buttonWrap: {
    marginHorizontal: 24,
    marginBottom: 48,
  },
  button: {
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#2ECC71',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default WelcomeScreen;
