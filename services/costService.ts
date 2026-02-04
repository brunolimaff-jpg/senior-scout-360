
import { CostInfo } from "../types";

// Pricing per 1 Million Tokens (USD)
// Estimated values based on Google Cloud Vertex AI / AI Studio pricing for Gemini 2.5 series
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 5.00 }, // Estimated, cheaper than old Pro
  'gemini-2.5-flash': { input: 0.075, output: 0.30 }, // Estimated, very efficient
  'gemini-3-pro-preview': { input: 2.50, output: 10.00 }, // Legacy/Preview High
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 }, // Legacy/Preview Low
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): CostInfo {
  const price = PRICING[model] || PRICING['gemini-2.5-flash']; // Default to 2.5 flash
  
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
