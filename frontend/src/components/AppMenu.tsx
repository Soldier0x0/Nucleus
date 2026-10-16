import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { menuSections } from "@/src/core/menu";
import { shownInDecoy } from "@/src/core/profiles";
import { Eyebrow, Icon, Press, T } from "./ui";

/**
 * Top-left menu (v0.9.8). One row per open module view, grouped by section.
 * Slides in and out; stays mounted until the close animation finishes.
 */
export function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { db, session } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const panel = Math.min(320, Math.round(width * 0.84));
  const slide = useRef(new Animated.Value(-panel)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const reduced = db.settings.reducedMotion;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        slide.setValue(0);
        fade.setValue(0.4);
        return;
      }
      slide.setValue(-panel);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.4, duration: 210, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (reduced) {
      setMounted(false);
      return;
    }
    Animated.parallel([
      Animated.timing(slide, { toValue: -panel, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, reduced, panel, slide, fade]);

  const sections = menuSections(db, (id) => session === "real" || shownInDecoy(id));
  const go = (route: string) => {
    onClose();
    router.push(route as never);
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Pressable testID="app-menu-backdrop" accessibilityLabel="Close menu" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
        </Animated.View>
        <Animated.View testID="app-menu" style={[styles.panel, { width: panel, backgroundColor: colors.surface, borderRightColor: colors.border, paddingTop: insets.top + 12, transform: [{ translateX: slide }] }]}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: sp.lg, marginBottom: 8 }}>
            <T v="title" style={{ flex: 1 }}>Nucleus</T>
            <Press testID="app-menu-close" accessibilityLabel="Close menu" onPress={onClose} style={styles.close}>
              <Icon name="close" size={22} color={colors.onSurface} />
            </Press>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: sp.md, paddingBottom: insets.bottom + 24 }}>
            <Press testID="app-menu-link-search" onPress={() => go("/search")} style={styles.row}>
              <View style={[styles.ic, { backgroundColor: colors.surfaceSecondary }]}><Icon name="magnify" size={18} color={colors.onSurface} /></View>
              <T v="label">Search</T>
            </Press>
            {sections.map((section) => (
              <View key={section.id} testID={`app-menu-section-${section.id}`} style={{ marginTop: 14 }}>
                <Eyebrow style={{ marginBottom: 4, marginLeft: 8 }}>{section.title}</Eyebrow>
                {section.links.map((link) => (
                  <Press key={link.id} testID={`app-menu-link-${link.id}`} onPress={() => go(link.route)} style={styles.row}>
                    <View style={[styles.ic, { backgroundColor: colors.surfaceSecondary }]}>
                      <Icon name={link.icon} size={18} color={colors.onSurface} />
                    </View>
                    <T v="label" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{link.label}</T>
                  </Press>
                ))}
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />
            <Press testID="app-menu-link-modules" onPress={() => go("/modules")} style={styles.row}>
              <View style={[styles.ic, { backgroundColor: colors.surfaceSecondary }]}><Icon name="view-grid-outline" size={18} color={colors.onSurface} /></View>
              <T v="label">Manage modules</T>
            </Press>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, borderRightWidth: 1 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 8, borderRadius: radius.md },
  ic: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
