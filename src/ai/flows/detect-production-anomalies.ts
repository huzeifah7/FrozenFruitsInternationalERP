'use server';
/**
 * @fileOverview An AI agent for detecting anomalies in production data.
 *
 * - detectProductionAnomalies - A function that handles the production anomaly detection process.
 * - DetectProductionAnomaliesInput - The input type for the detectProductionAnomalies function.
 * - DetectProductionAnomaliesOutput - The return type for the detectProductionAnomalies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectProductionAnomaliesInputSchema = z.object({
  productionOutputDescription: z
    .string()
    .describe(
      'A detailed description of recent daily production output, including quantities and dates. E.g., "2023-10-26: 100 units, 2023-10-27: 98 units, 2023-10-28: 50 units (significant drop)"'
    ),
  rawMaterialConsumptionDescription: z
    .string()
    .describe(
      'A detailed description of recent raw material consumption, including quantities, dates, and material types. E.g., "2023-10-26: 50kg steel, 2023-10-27: 52kg steel, 2023-10-28: 100kg steel (unexpected increase)"'
    ),
  historicalContext: z
    .string()
    .optional()
    .describe(
      'Optional historical data or contextual information that helps in anomaly detection. E.g., "Average daily output last month was 95 units, normal steel consumption is 50-55kg/day."'
    ),
});
export type DetectProductionAnomaliesInput = z.infer<
  typeof DetectProductionAnomaliesInputSchema
>;

const DetectProductionAnomaliesOutputSchema = z.object({
  anomalyDetected: z
    .boolean()
    .describe(
      'True if an anomaly in production output or raw material consumption is detected.'
    ),
  anomalyType: z
    .enum(['production_drop', 'material_increase', 'other', 'none'])
    .describe('The type of anomaly detected, or "none" if no anomaly.'),
  description: z
    .string()
    .describe(
      'A detailed description of the detected anomaly, including specific data points and impact.'
    ),
  suggestedCauses: z
    .array(z.string())
    .describe('A list of potential causes for the anomaly.'),
  recommendedActions: z
    .array(z.string())
    .describe('A list of recommended actions to investigate and address the anomaly.')
    .default([]),
});
export type DetectProductionAnomaliesOutput = z.infer<
  typeof DetectProductionAnomaliesOutputSchema
>;

export async function detectProductionAnomalies(
  input: DetectProductionAnomaliesInput
): Promise<DetectProductionAnomaliesOutput> {
  return detectProductionAnomaliesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectProductionAnomaliesPrompt',
  input: {schema: DetectProductionAnomaliesInputSchema},
  output: {schema: DetectProductionAnomaliesOutputSchema},
  prompt: `You are an expert Production Manager AI. Your task is to analyze daily production output and raw material consumption data to detect any significant anomalies. Look for sudden drops in yield, unexpected increases in material usage, or any other unusual patterns.

Analyze the following data:

Daily Production Output:
{{{productionOutputDescription}}}

Raw Material Consumption:
{{{rawMaterialConsumptionDescription}}}

{{#if historicalContext}}
Historical Context:
{{{historicalContext}}}
{{/if}}

Based on this information, determine if an anomaly is present. If so, describe the anomaly, identify its type (choose from 'production_drop', 'material_increase', 'other', or 'none'), list potential causes, and suggest recommended actions.`,
});

const detectProductionAnomaliesFlow = ai.defineFlow(
  {
    name: 'detectProductionAnomaliesFlow',
    inputSchema: DetectProductionAnomaliesInputSchema,
    outputSchema: DetectProductionAnomaliesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
