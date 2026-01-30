
import { CostInfo } from "../types";

// Pricing per 1 Million Tokens (USD)
// Estimated values based on Google Cloud Vertex AI / AI Studio pricing
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3-pro-preview': { input: 2.50, output: 10.00 }, // High Intelligence
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 }, // High Speed/Low Cost
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): CostInfo {
  const price = PRICING[model] || PRICING['gemini-3-flash-preview']; // Default to flash if unknown
  
  const inputCost = (inputTokens / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;
  
  return {
    model: model,
    inputTokens,
    outputTokens,
    totalCost: inputCost + outputCost
  };
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `< $0.01`;
  return `$${cost.toFixed(4)}`;
}
