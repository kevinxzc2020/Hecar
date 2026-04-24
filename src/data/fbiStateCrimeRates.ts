/**
 * 2022 年 FBI Uniform Crime Reporting (UCR) 各州暴力犯罪率
 * 数据来源：FBI Crime Data Explorer https://cde.ucr.cjis.gov/
 * 单位：violent crime per 100,000 population
 *
 * 分档（用于 fallback 颜色）：
 *   < 250   → low（全美均值 ~380，低于均值明显的算低）
 *   250-450 → moderate
 *   > 450   → high
 *
 * 数据快照截至 2022，一般年度波动 < 5%。需要更新时在 cde.ucr.cjis.gov 重拉。
 */
export const FBI_STATE_VIOLENT_CRIME_2022: Record<string, number> = {
  AL: 452.8,
  AK: 759.7,
  AZ: 431.9,
  AR: 645.2,
  CA: 499.5,
  CO: 492.0,
  CT: 185.0,
  DE: 434.7,
  FL: 258.9,
  GA: 351.7,
  HI: 276.1,
  ID: 239.0,
  IL: 395.1,
  IN: 343.4,
  IA: 276.1,
  KS: 420.3,
  KY: 247.6,
  LA: 629.1,
  ME: 102.5,
  MD: 399.6,
  MA: 303.4,
  MI: 467.7,
  MN: 288.9,
  MS: 302.4,
  MO: 491.6,
  MT: 454.1,
  NE: 323.5,
  NV: 455.3,
  NH: 123.3,
  NJ: 200.7,
  NM: 780.5,
  NY: 434.4,
  NC: 363.0,
  ND: 284.9,
  OH: 293.2,
  OK: 410.4,
  OR: 336.3,
  PA: 351.0,
  RI: 214.5,
  SC: 518.2,
  SD: 406.1,
  TN: 628.4,
  TX: 431.9,
  UT: 242.3,
  VT: 197.7,
  VA: 208.1,
  WA: 375.6,
  WV: 283.5,
  WI: 289.9,
  WY: 196.4,
  DC: 1150.9,
};

export function classifyViolent(rate: number): "low" | "moderate" | "high" {
  if (rate < 250) return "low";
  if (rate < 450) return "moderate";
  return "high";
}
