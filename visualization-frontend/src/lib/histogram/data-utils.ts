import type { HistogramBin, HistogramData } from "./types"

/**
 * Generate mock R-squared distribution histogram data
 */
export function generateRSquaredHistogram(distFunc: string, dimension: string): HistogramBin[] {
  const seed = distFunc === "chi" ? 0 : 0.05
  const dimOffset = dimension === "2D" ? 0 : 0.08

  return [
    { bin: "0.00", count: 0 },
    { bin: "0.05", count: 0 },
    { bin: "0.10", count: 0 },
    { bin: "0.15", count: 0 },
    { bin: "0.20", count: 0 },
    { bin: "0.25", count: Math.round(1 + seed * 2 + dimOffset * 5) },
    { bin: "0.30", count: Math.round(1 + seed + dimOffset * 3) },
    { bin: "0.35", count: Math.round(2 + seed * 3) },
    { bin: "0.40", count: Math.round(2 + seed * 2) },
    { bin: "0.45", count: Math.round(6 + seed * 4 - dimOffset * 10) },
    { bin: "0.50", count: Math.round(9 + seed - dimOffset * 5) },
    { bin: "0.55", count: Math.round(9 + seed * 2) },
    { bin: "0.60", count: Math.round(10 + seed - dimOffset * 3) },
    { bin: "0.65", count: Math.round(6 + seed) },
    { bin: "0.70", count: Math.round(16 - seed * 2 + dimOffset * 4) },
    { bin: "0.75", count: Math.round(7 + seed + dimOffset * 3) },
    { bin: "0.80", count: Math.round(11 - seed + dimOffset * 2) },
    { bin: "0.85", count: Math.round(8 - seed * 2) },
    { bin: "0.90", count: Math.round(5 + seed) },
    { bin: "0.95", count: Math.round(4 - seed) },
  ].map((d) => ({ ...d, count: Math.max(0, d.count) }))
}

/**
 * Calculate cumulative counts from histogram bins
 */
export function calculateCumulative(bins: HistogramBin[]): number[] {
  let running = 0
  return bins.map((d) => {
    running += d.count
    return running
  })
}

/**
 * Generate histogram data with cumulative counts
 */
export function generateHistogramData(distFunc: string, dimension: string): HistogramData {
  const bins = generateRSquaredHistogram(distFunc, dimension)
  const cumulative = calculateCumulative(bins)
  return { bins, cumulative }
}

/**
 * Convert a threshold value (0-1) to the corresponding bin label
 */
export function thresholdToBinLabel(threshold: number): string {
  return threshold.toFixed(2)
}

/**
 * Find the X position for a threshold value within the chart
 */
export function getThresholdXPosition(
  threshold: number,
  bins: HistogramBin[],
  plotLeft: number,
  barWidth: number,
  barGap: number
): number {
  // Find which bin the threshold falls into or between
  const binValue = threshold
  
  for (let i = 0; i < bins.length; i++) {
    const binStart = parseFloat(bins[i].bin)
    const binEnd = binStart + 0.05 // Each bin is 0.05 wide
    
    if (binValue >= binStart && binValue < binEnd) {
      // Threshold is within this bin - interpolate position
      const binX = plotLeft + i * (barWidth + barGap)
      const progress = (binValue - binStart) / 0.05
      return binX + progress * barWidth
    }
  }
  
  // If threshold is beyond all bins, return the end
  return plotLeft + bins.length * (barWidth + barGap)
}

/**
 * Calculate total SKUs from histogram bins
 */
export function calculateTotalSkus(bins: HistogramBin[]): number {
  return bins.reduce((sum, bin) => sum + bin.count, 0)
}

/**
 * Calculate excluded SKUs (below threshold) from histogram bins
 */
export function calculateExcludedSkus(bins: HistogramBin[], threshold: number): number {
  return bins.reduce((sum, bin) => {
    const binValue = parseFloat(bin.bin)
    // Exclude if the bin's upper edge (bin + 0.05) is at or below threshold
    if (binValue + 0.05 <= threshold) {
      return sum + bin.count
    }
    return sum
  }, 0)
}
