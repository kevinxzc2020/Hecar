import type { ExpoConfig } from "expo/config";

// 从环境变量读 key；没配就留 undefined，各服务层自己降级
const googlePlacesApiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const anthropicApiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const fbiApiKey = process.env.EXPO_PUBLIC_FBI_API_KEY;

const config: ExpoConfig = {
  name: "Hecar",
  slug: "Hecar",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "hecar",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Hecar needs your location to show nearby gas stations and EV chargers.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googlePlacesApiKey,
    anthropicApiKey,
    fbiApiKey,
  },
};

export default config;
