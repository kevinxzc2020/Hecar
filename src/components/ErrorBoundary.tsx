import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, View, Text } from "react-native";
import { colors, fontSize, spacing, radius } from "../theme";

interface Props {
  children: ReactNode;
  /** 出错时用于替换 children 的节点；可以是 React element 或 (error) => element */
  fallback?: ReactNode | ((error: Error) => ReactNode);
  /** 边界名字，用于日志定位 */
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * 通用错误边界。仅能捕获 React 渲染期/lifecycle 里的同步错误，
 * 对异步（setTimeout、Promise）、事件处理器、import 时抛错都无效。
 *
 * 需要兜住 import 时错误请用 try/require 模式，参考 StationMap.tsx。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.warn(
        `[ErrorBoundary${this.props.name ? ` ${this.props.name}` : ""}]`,
        error,
        info.componentStack,
      );
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback(error);
    if (fallback !== undefined) return fallback;

    // 默认 fallback：一张暗色卡片
    return (
      <View style={styles.container}>
        <Text style={styles.title}>出了点问题</Text>
        <Text style={styles.msg} numberOfLines={3}>
          {error.message}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  title: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  msg: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
