import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../src/theme";
import { useApp } from "../src/context/AppContext";
import { Expense } from "../src/types";

export default function AddExpenseScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();

  const [expenseType, setExpenseType] = useState<"gas" | "charge">("gas");
  const [amount, setAmount] = useState("");
  const [liters, setLiters] = useState("");
  const [kwh, setKwh] = useState("");
  const [stationName, setStationName] = useState("");
  const [odometer, setOdometer] = useState("");

  const handleSave = () => {
    if (!amount || !stationName) {
      Alert.alert("请填写", "金额和站点名称不能为空");
      return;
    }
    const expense: Expense = {
      id: `e-${Date.now()}`,
      vehicleId: state.activeVehicleId ?? "v-1",
      type: expenseType,
      amount: parseFloat(amount),
      liters: liters ? parseFloat(liters) : undefined,
      kwh: kwh ? parseFloat(kwh) : undefined,
      stationName,
      date: new Date().toISOString(),
      odometer: odometer ? parseInt(odometer, 10) : undefined,
    };
    dispatch({ type: "ADD_EXPENSE", payload: expense });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>记录消费</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveBtn}>保存</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Type toggle */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                expenseType === "gas" && styles.typeBtnActiveGas,
              ]}
              onPress={() => setExpenseType("gas")}
            >
              <Ionicons
                name="flame"
                size={18}
                color={expenseType === "gas" ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeText,
                  expenseType === "gas" && styles.typeTextActive,
                ]}
              >
                加油
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                expenseType === "charge" && styles.typeBtnActiveEV,
              ]}
              onPress={() => setExpenseType("charge")}
            >
              <Ionicons
                name="flash"
                size={18}
                color={expenseType === "charge" ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeText,
                  expenseType === "charge" && styles.typeTextActive,
                ]}
              >
                充电
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount — big input */}
          <View style={styles.amountSection}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Fields */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>站点名称</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="例如：Chevron Market St"
              placeholderTextColor={colors.textMuted}
              value={stationName}
              onChangeText={setStationName}
            />
          </View>

          {expenseType === "gas" ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>加油量（升）</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="可选"
                placeholderTextColor={colors.textMuted}
                value={liters}
                onChangeText={setLiters}
                keyboardType="decimal-pad"
              />
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>充电量（kWh）</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="可选"
                placeholderTextColor={colors.textMuted}
                value={kwh}
                onChangeText={setKwh}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>里程表读数</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="可选"
              placeholderTextColor={colors.textMuted}
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="number-pad"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveBtn: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  scroll: { padding: spacing.lg },

  typeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xxl },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
  },
  typeBtnActiveGas: { backgroundColor: colors.gas },
  typeBtnActiveEV: { backgroundColor: colors.ev },
  typeText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: "600" },
  typeTextActive: { color: "#fff" },

  amountSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxxl,
  },
  dollar: {
    color: colors.textMuted,
    fontSize: 36,
    fontWeight: "300",
    marginRight: 4,
  },
  amountInput: {
    color: colors.textPrimary,
    fontSize: 48,
    fontWeight: "700",
    minWidth: 120,
    textAlign: "center",
  },

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
});
