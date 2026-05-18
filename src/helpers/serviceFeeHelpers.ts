/** Admin-configured rate row (subset of persisted doc). */
export type ServiceFeeRateInput = {
  ratePercent?: number;
  minimumCap?: number | null;
  maximumCap?: number | null;
};

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function capDefined(v: unknown): boolean {
  return v !== undefined && v !== null;
}

/**
 * Platform service fee on merchandise total T:
 * - No row OR both caps unset → T × 3.5%
 * - Either cap set → raw = T × (ratePercent / 100), then clamp to min/max when present.
 */
export function computePlatformTxnFee(
  merchandiseTotal: number,
  rateDoc: ServiceFeeRateInput | null | undefined
): number {
  const T = Math.max(0, merchandiseTotal);
  if (!rateDoc) {
    return roundMoney2(T * 0.035);
  }

  const minCap = rateDoc.minimumCap;
  const maxCap = rateDoc.maximumCap;
  const hasMin = capDefined(minCap);
  const hasMax = capDefined(maxCap);

  if (!hasMin && !hasMax) {
    return roundMoney2(T * 0.035);
  }

  const pct =
    typeof rateDoc.ratePercent === "number" && !Number.isNaN(rateDoc.ratePercent)
      ? rateDoc.ratePercent
      : 3.5;

  let raw = T * (pct / 100);
  if (hasMin) raw = Math.max(raw, Number(minCap));
  if (hasMax) raw = Math.min(raw, Number(maxCap));
  return roundMoney2(raw);
}
