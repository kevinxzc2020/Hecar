import { StyleSheet, Text, View } from "react-native";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hecar</Text>
      <Text style={styles.subtitle}>找到最优加油充电方案</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#0EA5E9",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 8,
  },
});
