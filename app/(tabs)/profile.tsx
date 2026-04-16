import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../../src/theme";
import { useApp } from "../../src/context/AppContext";

export default function ProfileScreen() {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const user = state.user;
  const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);

  const planLabel =
    state.user?.plan === "pro"
      ? "Pro"
      : state.user?.plan === "plus"
      ? "Plus"
      : "Free";
  const planColor =
    state.user?.plan === "pro"
      ? "#A855F7"
      : state.user?.plan === "plus"
      ? colors.primary
      : colors.textSecondary;

  const menuItems: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    color?: string;
    badge?: string;
  }[] = [
    {
      icon: "car-sport",
      label: "我的车辆",
      onPress: () => router.push("/add-vehicle" as any),
      badge: `${state.vehicles.length} 辆`,
    },
    {
      icon: "diamond",
      label: "订阅管理",
      onPress: () => Alert.alert("订阅", "订阅功能即将上线"),
      badge: planLabel,
      color: planColor,
    },
    {
      icon: "notifications",
      label: "通知设置",
      onPress: () => Alert.alert("通知", "通知设置即将上线"),
    },
    {
      icon: "shield-checkmark",
      label: "隐私政策",
      onPress: () => Alert.alert("隐私", "隐私政策页面即将上线"),
    },
    {
      icon: "help-circle",
      label: "帮助与反馈",
      onPress: () => Alert.alert("帮助", "帮助中心即将上线"),
    },
    {
      icon: "information-circle",
      label: "关于 Hecar",
      onPress: () => Alert.alert("Hecar", "Version 1.0.0"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.displayName?.[0]?.toUpperCase() ?? "U"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName ?? "未登录"}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ""}</Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: planColor + "20" }]}>
            <Text style={[styles.planText, { color: planColor }]}>
              {planLabel}
            </Text>
          </View>
        </View>

        {/* Active vehicle */}
        {vehicle && (
          <TouchableOpacity
            style={styles.vehicleCard}
            onPress={() => router.push("/add-vehicle" as any)}
            activeOpacity={0.7}
          >
            <View style={styles.vehicleIcon}>
              <Ionicons
                name={
                  vehicle.fuelType === "electric"
                    ? "flash"
                    : vehicle.fuelType === "hybrid"
                    ? "leaf"
                    : "flame"
                }
                size={22}
                color={
                  vehicle.fuelType === "electric"
                    ? colors.ev
                    : vehicle.fuelType === "hybrid"
                    ? colors.primary
                    : colors.gas
                }
              />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>{vehicle.nickname}</Text>
              <Text style={styles.vehicleMeta}>
                {vehicle.year} {vehicle.brand} {vehicle.model}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.menuRow}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.color ?? colors.textSecondary}
              />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <View style={styles.menuRight}>
                {item.badge && (
                  <Text
                    style={[
                      styles.menuBadge,
                      item.color ? { color: item.color } : {},
                    ]}
                  >
                    {item.badge}
                  </Text>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert("退出登录", "确定退出？", [
            { text: "取消" },
            { text: "退出", style: "destructive" },
          ])}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Hecar v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 40 },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: fontSize.xl, fontWeight: "700" },
  userInfo: { flex: 1 },
  userName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  userEmail: { color: colors.textSecondary, fontSize: fontSize.xs },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  planText: { fontSize: fontSize.xs, fontWeight: "700" },

  // Vehicle card
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: 12,
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleInfo: { flex: 1 },
  vehicleName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  vehicleMeta: { color: colors.textSecondary, fontSize: fontSize.xs },

  // Menu
  menuSection: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuBadge: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xxl,
    paddingVertical: 14,
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.danger + "15",
  },
  logoutText: { color: colors.danger, fontSize: fontSize.md, fontWeight: "600" },

  version: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
