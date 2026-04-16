import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../../src/theme";
import { useApp } from "../../src/context/AppContext";

export default function ReportScreen() {
  const { state } = useApp();
  const router = useRouter();

  const expenses = state.expenses;
  const now = new Date();
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = expenses.filter((e) => {
    const d = new Date(e.date);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  });

  const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
  const allTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const avgPerFill = expenses.length > 0 ? allTotal / expenses.length : 0;

  // Simple bar chart data — last 6 fills
  const recent = expenses.slice(0, 6).reverse();
  const maxAmount = Math.max(...recent.map((e) => e.amount), 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>本月花费</Text>
            <Text style={styles.summaryValue}>${thisTotal.toFixed(2)}</Text>
            <Text style={styles.summaryMeta}>{thisMonth.length} 次加油</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>上月花费</Text>
            <Text style={styles.summaryValue}>${lastTotal.toFixed(2)}</Text>
            <Text style={styles.summaryMeta}>{lastMonth.length} 次加油</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>总花费</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              ${allTotal.toFixed(2)}
            </Text>
            <Text style={styles.summaryMeta}>{expenses.length} 笔记录</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>平均每次</Text>
            <Text style={styles.summaryValue}>${avgPerFill.toFixed(2)}</Text>
          </View>
        </View>

        {/* Mini bar chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>最近消费</Text>
          <View style={styles.chartContainer}>
            {recent.map((e) => {
              const h = (e.amount / maxAmount) * 120;
              const d = new Date(e.date);
              return (
                <View key={e.id} style={styles.barGroup}>
                  <Text style={styles.barValue}>${e.amount.toFixed(0)}</Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor:
                          e.type === "gas" ? colors.gas : colors.ev,
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>
                    {d.getMonth() + 1}/{d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>消费记录</Text>
          {expenses.slice(0, 10).map((e) => {
            const d = new Date(e.date);
            return (
              <View key={e.id} style={styles.txRow}>
                <View
                  style={[
                    styles.txIcon,
                    {
                      backgroundColor:
                        e.type === "gas" ? colors.gas + "20" : colors.ev + "20",
                    },
                  ]}
                >
                  <Ionicons
                    name={e.type === "gas" ? "flame" : "flash"}
                    size={18}
                    color={e.type === "gas" ? colors.gas : colors.ev}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txName}>{e.stationName}</Text>
                  <Text style={styles.txDate}>
                    {d.getFullYear()}-{String(d.getMonth() + 1).padStart(2, "0")}-
                    {String(d.getDate()).padStart(2, "0")}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txAmount}>-${e.amount.toFixed(2)}</Text>
                  {e.liters != null && (
                    <Text style={styles.txMeta}>{e.liters}L</Text>
                  )}
                  {e.kwh != null && (
                    <Text style={styles.txMeta}>{e.kwh}kWh</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* FAB — add expense */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/add-expense" as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 100 },

  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: "700",
  },
  summaryMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  chartSection: { marginTop: spacing.xl },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 170,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  barGroup: { alignItems: "center", gap: 4 },
  bar: { width: 28, borderRadius: 4 },
  barValue: { color: colors.textSecondary, fontSize: 10, fontWeight: "600" },
  barLabel: { color: colors.textMuted, fontSize: 10 },

  section: { marginTop: spacing.xxl },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: { flex: 1 },
  txName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: "600" },
  txDate: { color: colors.textMuted, fontSize: fontSize.xs },
  txRight: { alignItems: "flex-end" },
  txAmount: { color: colors.danger, fontSize: fontSize.md, fontWeight: "700" },
  txMeta: { color: colors.textMuted, fontSize: fontSize.xs },

  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
