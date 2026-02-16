import { tool } from 'ai';
import z from 'zod';

export const FILTER_RESULT_LIMIT = 25;

export const expenseFilterSchema = z.object({
  startDate: z.string().optional().describe('Inclusive start date in YYYY-MM-DD format.'),
  endDate: z.string().optional().describe('Inclusive end date in YYYY-MM-DD format.'),
  category: z.string().optional().describe('Expense category, e.g. Groceries, Dining, Entertainment.'),
  minAmount: z.number().optional().describe('Minimum transaction amount in USD.'),
  maxAmount: z.number().optional().describe('Maximum transaction amount in USD.'),
  vendor: z.string().optional().describe('Case-insensitive vendor match by partial name.'),
  excludeAnomalies: z.boolean().optional().describe('Set true when the user asks to exclude outliers/anomalies.')
});

export const tools = {
  filter_expenses: tool({
    description: 'Return the matching transactions. Use this for listing expenses or getting transaction-level details.',
    inputSchema: expenseFilterSchema
  }),
  calculate_statistics: tool({
    description: 'Calculate a single metric over filtered expenses.',
    inputSchema: expenseFilterSchema.extend({
      metric: z.enum(['sum', 'mean', 'median', 'min', 'max', 'count']).describe('Metric to compute for filtered transactions.')
    })
  }),
  aggregate_expenses: tool({
    description: 'Group filtered expenses and compute one metric per group, useful for category/month/vendor breakdowns.',
    inputSchema: expenseFilterSchema.extend({
      groupBy: z.enum(['category', 'vendor', 'month']).describe('Dimension used for grouping results.'),
      metric: z.enum(['sum', 'count', 'mean', 'median']).describe('Metric to compute per group.')
    })
  })
};

