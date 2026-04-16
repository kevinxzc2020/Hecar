import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../../src/theme";
import { useApp } from "../../src/context/AppContext";
import { mockGasStations, mockEVStations } from "../../src/data/mockStations";
import { Station, GasStation, EVStation, isGasStation } from "../../src/types";

type SortBy = "price" | "distance" | "rating";

export default function ListScreen() {
  const { state } = useApp();
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortBy>("price");

  const isGas = state.fuelMode === "gas";
  const raw: Station[] = isGas ? mockGasStations : mockEVStations;

  const sorted = [...raw].sort((a, b) => {
    if (sortBy === "distance") return a.distance - b.distance;
    if (sortBy === "rating") return b.rating - a.rating;
    // price
    if (isGasStation(a) && isGasStation(b)) {
      return (a.prices.regular ?? 99) - (b.prices.regular ?? 99);
    }
    if (!isGasStation(a) && !isGasStation(b)) {
      const aMin = Math.min(...(a as EVStation).chargers.map((c) => c.pricePerKwh));
      const bMin = Math.min(...(b as EVStation).chargers.map((c) => c.pricePerKwh));
      return aMin - bMin;
    }
    return 0;
  });

  const handlePress = (station: Station) => {
    router.push(
      `/station-detail?id=${station.id}&mode=${state.fuelMode}` as any
    );
  };

  const renderGasItem = ({ item }: { item: GasStation }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconCircle, { backgroundColor: colors.gas + "20" }]}>
          <Ionicons name="flame" size={20} color={colors.gas} />
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowAddr} numberOfLines={1}>{item.address}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>
          ${item.prices.regular?.toFixed(2) ?? "—"}
        </Text>
        <Text style={styles.rowMeta}>{item.distance} km</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEVItem = ({ item }: { item: EVStation }) => {
    const avail = item.chargers.filter((c) => c.status === "available").length;
    const cheapest = Math.min(...item.chargers.map((c) => c.pricePerKwh));
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.ev + "20" }]}>
            <Ionicons name="flash" size={20} color={colors.ev} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.rowSubRow}>
              <Text style={styles.rowAddr}>{item.network}</Text>
              <View style={styles.availDot}>
                <View
                  style={[
                    styles.dotSmall,
                    { backgroundColor: avail > 0 ? colors.available : colors.danger },
                  ]}
                />
                <Text style={styles.rowAddr}>
                  {avail}/{item.chargers.length}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowPrice, { color: colors.ev }]}>
            ${cheapest.toFixed(2)}
          </Text>
          <Text style={styles.rowMeta}>{item.distance} km</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Sort buttons */}
      <View style={styles.sortBar}>
        {(["price", "distance", "rating"] as SortBy[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
            onPress={() => setSortBy(s)}
          >
            <Text
              style={[styles.sortText, sortBy === s && styles.sortTextActive]}
            >
              {s === "price" ? "价格" : s === "distance" ? "距离" : "评分"}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Gas/EV mini toggle */}
        <View style={styles.miniToggle}>
          <Ionicons
            name={isGas ? "flame" : "flash"}
            size={14}
            color={isGas ? colors.gas : colors.ev}
          />
          <Text style={[styles.sortText, { color: isGas ? colors.gas : colors.ev }]}>
            {isGas ? "Gas" : "EV"}
          </Text>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={isGas
          ? (props) => renderGasItem(props as any)
          : (props) => renderEVItem(props as any)
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sortBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: "center",
  },
  sortBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
  },
  sortBtnActive: { backgroundColor: colors.primary },
  sortText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "600" },
  sortTextActive: { color: "#fff" },
  miniToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
  },
  listContent: { paddingBottom: 20 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  rowAddr: { color: colors.textSecondary, fontSize: fontSize.xs },
  rowSubRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  availDot: { flexDirection: "row", alignItems: "center", gap: 4 },
  dotSmall: { width: 6, height: 6, borderRadius: 3 },
  rowRight: { alignItems: "flex-end", marginLeft: 10 },
  rowPrice: {
    color: colors.gas,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  rowMeta: { color: colors.textMuted, fontSize: fontSize.xs },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
});
