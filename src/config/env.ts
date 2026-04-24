import Constants from "expo-constants";

/**
 * 统一的运行时 config。
 *
 * 从 app.config.ts 里 `extra` 读出，`extra` 又从 EXPO_PUBLIC_* 环境变量注入。
 * key 缺失时各 service 层必须自己降级，不要 throw。
 */
interface Extra {
  googlePlacesApiKey?: string;
  anthropicApiKey?: string;
  fbiApiKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const env = {
  googlePlacesApiKey: extra.googlePlacesApiKey,
  anthropicApiKey: extra.anthropicApiKey,
  fbiApiKey: extra.fbiApiKey,
  hasGooglePlaces: !!extra.googlePlacesApiKey,
  hasAnthropic: !!extra.anthropicApiKey,
  hasFbi: !!extra.fbiApiKey,
};
