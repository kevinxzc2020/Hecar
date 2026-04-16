import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../src/theme";
import { useApp } from "../src/context/AppContext";
import { Vehicle, VehicleFuelType } from "../src/types";

const BRANDS = [
  "Toyota", "Honda", "Tesla", "BMW", "Mercedes", "Ford",
  "Chevrolet", "Hyundai", "Kia", "Nissan", "Volkswagen", "Audi",
];

export default function AddVehicleScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();

  const [nickname, setNickname] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("2024");
  const [fuelType, setFuelType] = useState<VehicleFuelType>("gas");

  const existing = state.vehicles;

  const handleSave = () => {
    if (!brand || !model) {
      Alert.alert("请填写", "品牌和型号不能为空");
      return;
    }

    // Free plan: max 1 vehicle
    if (state.user?.plan === "free" && existing.length >= 1) {
      Alert.alert(
        "升级 Plus",
        "免费版最多管理1辆车，升级 Plus 解锁无限车辆管理",
        [{ text: "知道了" }]
      );
      return;
    }

    const vehicle: Vehicle = {
      id: `v-${Date.now()}`,
      nickname: nickname || `${brand} ${model}`,
      brand,
      model,
      year: parseInt(year, 10) || 2024,
      fuelType,
    };
    dispatch({ type: "ADD_VEHICLE", payload: vehicle });
    router.back();
  };

  const fuelTypes: { key: VehicleFuelType; label: string; icon: string; color: string }[] = [
    { key: "gas", label: "燃油车", icon: "flame", color: colors.gas },
    { key: "electric", label: "电动车", icon: "flash", color: colors.ev },
    { key: "hybrid", label: "混动", icon: "leaf", color: colors.primary },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existing.length > 0 ? "添加车辆" : "添加你的第一辆车"}
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveBtn}>保存</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Fuel type selector */}
        <Text style={styles.sectionLabel}>车辆类型</Text>
        <View style={styles.fuelRow}>
          {fuelTypes.map((ft) => (
            <TouchableOpacity
              key={ft.key}
              style={[
                styles.fuelCard,
                fuelType === ft.key && {
                  borderColor: ft.color,
                  backgroundColor: ft.color + "15",
                },
              ]}
              onPress={() => setFuelType(ft.key)}
            >
              <Ionicons
                name={ft.icon as any}
                size={24}
                color={fuelType === ft.key ? ft.color : colors.textMuted}
              />
              <Text
                style={[
                  styles.fuelLabel,
                  fuelType === ft.key && { color: ft.color },
                ]}
              >
                {ft.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Brand selector */}
        <Text style={styles.sectionLabel}>品牌</Text>
        <View style={styles.brandGrid}>
          {BRANDS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[
                styles.brandChip,
                brand === b && styles.brandChipActive,
              ]}
              onPress={() => setBrand(b)}
            >
              <Text
                style={[
                  styles.brandText,
                  brand === b && styles.brandTextActive,
                ]}
              >
                {b}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Model */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>型号</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="例如：Camry, Model 3"
            placeholderTextColor={colors.textMuted}
            value={model}
            onChangeText={setModel}
          />
        </View>

        {/* Year */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>年份</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="2024"
            placeholderTextColor={colors.textMuted}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>

        {/* Nickname */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>昵称（可选）</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="例如：My Car"
            placeholderTextColor={colors.textMuted}
            value={nickname}
            onChangeText={setNickname}
          />
        </View>

        {/* Existing vehicles list */}
        {existing.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>
              已有车辆
            </Text>
            {existing.map((v) => (
              <View key={v.id} style={styles.existingRow}>
                <Ionicons
                  name={
                    v.fuelType === "electric"
                      ? "flash"
                      : v.fuelType === "hybrid"
                      ? "leaf"
                      : "flame"
                  }
                  size={18}
                  color={
                    v.fuelType === "electric"
                      ? colors.ev
                      : v.fuelType === "hybrid"
                      ? colors.primary
                      : colors.gas
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.existingName}>{v.nickname}</Text>
                  <Text style={styles.existingMeta}>
                    {v.year} {v.brand} {v.model}
                  </Text>
                </View>
                {state.activeVehicleId === v.id && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeText}>当前</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  saveBtn: { color: colors.primary, fontSize: fontSize.md, fontWeight: "700" },
  scroll: { padding: spacing.lg, paddingBottom: 40 },

  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },

  // Fuel type
  fuelRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xxl },
  fuelCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: "transparent",
    gap: 6,
  },
  fuelLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: "600" },

  // Brand grid
  brandGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
  },
  brandChipActive: { backgroundColor: colors.primary },
  brandText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "600" },
  brandTextActive: { color: "#fff" },

  // Fields
  field: { marginBottom: spacing.lg },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  fieldInput: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },

  // Existing vehicles
  existingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  existingName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  existingMeta: { color: colors.textSecondary, fontSize: fontSize.xs },
  activeBadge: {
    backgroundColor: colors.primary + "20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  activeText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: "700" },
});
