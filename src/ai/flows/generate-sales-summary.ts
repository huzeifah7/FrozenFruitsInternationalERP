'use server';
/**
 * @fileOverview A Genkit flow that generates a summary of sales performance.
 *
 * - generateSalesSummary - A function that handles the sales summary generation process.
 * - GenerateSalesSummaryInput - The input type for the generateSalesSummary function.
 * - GenerateSalesSummaryOutput - The return type for the generateSalesSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSalesSummaryInputSchema = z.object({
  timePeriod: z.string().describe('The time period for which the sales summary is requested (e.g., "last week", "past month").'),
  topSellingProducts: z
    .array(z.string())
    .describe('A list of top-selling product names during the specified time period.'),
  newCustomerAcquisitions: z
    .number()
    .int()
    .min(0)
    .describe('The total number of new customer acquisitions during the specified time period.'),
  orderVolumeChangeDescription: z
    .string()
    .describe('A description of any notable changes in order volume (e.g., "increased by 10%", "decreased by 5%").'),
});
export type GenerateSalesSummaryInput = z.infer<typeof GenerateSalesSummaryInputSchema>;

const GenerateSalesSummaryOutputSchema = z.object({
  summary: z.string().describe('An AI-generated summary of recent sales performance.'),
});
export type GenerateSalesSummaryOutput = z.infer<typeof GenerateSalesSummaryOutputSchema>;

export async function generateSalesSummary(input: GenerateSalesSummaryInput): Promise<GenerateSalesSummaryOutput> {
  return generateSalesSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSalesSummaryPrompt',
  input: {schema: GenerateSalesSummaryInputSchema},
  output: {schema: GenerateSalesSummaryOutputSchema},
  prompt: `As a Sales Manager, I need a concise summary of our recent sales performance for the {{{timePeriod}}}.

Based on the following data, provide a summary including top-selling products, new customer acquisitions, and any notable changes in order volume to quickly assess our current sales health.

Top Selling Products: {{{topSellingProducts}}}
New Customer Acquisitions: {{{newCustomerAcquisitions}}}
Order Volume Change: {{{orderVolumeChangeDescription}}}`,
});

const generateSalesSummaryFlow = ai.defineFlow(
  {
    name: 'generateSalesSummaryFlow',
    inputSchema: GenerateSalesSummaryInputSchema,
    outputSchema: GenerateSalesSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
