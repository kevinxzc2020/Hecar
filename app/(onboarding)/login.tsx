import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../../src/theme";
import { useApp } from "../../src/context/AppContext";

export default function LoginScreen() {
  const router = useRouter();
  const { dispatch } = useApp();

  const handleLogin = (method: string) => {
    // Mock login — will be replaced with Supabase Auth
    dispatch({
      type: "SET_USER",
      payload: {
        id: "user-1",
        email: "user@hecar.app",
        displayName: "Hecar User",
        plan: "free",
      },
    });
    dispatch({ type: "SET_ONBOARDED", payload: true });
    router.replace("/(tabs)" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>HECAR</Text>
          <Text style={styles.tagline}>
            找到最近、最便宜、最优的{"\n"}加油充电方案
          </Text>
        </View>

        {/* Login buttons */}
        <View style={styles.btnSection}>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: "#fff" }]}
            onPress={() => handleLogin("apple")}
          >
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={[styles.loginBtnText, { color: "#000" }]}>
              通过 Apple 登录
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: "#4285F4" }]}
            onPress={() => handleLogin("google")}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.loginBtnText}>通过 Google 登录</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.bgCard }]}
            onPress={() => handleLogin("email")}
          >
            <Ionicons name="mail" size={20} color={colors.textPrimary} />
            <Text style={styles.loginBtnText}>邮箱登录</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          登录即表示你同意我们的服务条款和隐私政策
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxxl,
  },
  logoSection: { alignItems: "center", marginBottom: 80 },
  logo: {
    fontSize: 52,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 4,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
  },
  btnSection: { gap: 12 },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: radius.lg,
    gap: 10,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  terms: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "center",
    marginTop: spacing.xxl,
    lineHeight: 18,
  },
});
