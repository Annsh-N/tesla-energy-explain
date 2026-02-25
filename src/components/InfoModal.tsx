import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, spacing } from "../theme/tokens";
import { theme, withOpacity } from "../theme/theme";
import { Card } from "./Card";

type InfoModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CLOSE_HIT_TARGET = 44;
const INITIAL_CARD_SCALE = 0.96;

export function InfoModal({ visible, onClose }: InfoModalProps) {
  const [isMounted, setIsMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(INITIAL_CARD_SCALE)).current;

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 110,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!isMounted) {
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: INITIAL_CARD_SCALE,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [backdropOpacity, cardOpacity, cardScale, isMounted, visible]);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdropPressable} onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.cardWrap,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            <Pressable onPress={() => undefined}>
              <Card style={styles.card}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}
                >
                  <Ionicons name="close-outline" size={20} color={colors.icon} />
                </Pressable>

                <Text style={styles.title}>Explain Energy</Text>
                <Text style={styles.body}>
                  This demo shows an explainability layer for Tesla Energy behavior.
                  Select a time window to see a timeline of decisions with reasons,
                  then replay how settings could change outcomes.
                </Text>
                <Text style={styles.caption}>Demo only. Illustrative data.</Text>
              </Card>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: withOpacity("#000000", 0.6),
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 420,
  },
  card: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.divider,
    borderWidth: 1,
  },
  closeButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: CLOSE_HIT_TARGET,
    height: CLOSE_HIT_TARGET,
    borderRadius: CLOSE_HIT_TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    zIndex: 2,
  },
  closeButtonPressed: {
    opacity: 0.85,
  },
  title: {
    ...theme.typography.title,
    paddingRight: spacing.xxl,
  },
  body: {
    ...theme.typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  caption: {
    ...theme.typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
