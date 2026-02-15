import z from "zod";
import { tool } from "ai";
import { Expense } from "./agent/types";
import { isBetween } from "./utils/date-helpers";
import { detectAnomalies } from "./utils/anomaly-helper";
import * as math from "./utils/math-helpers";

const filterLogic = (expenses: Expense[], args: {
    startDate?: string;
    endDate?: string;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    vendor?: string;
    excludeAnomalies?: boolean;
}) => {
    let filtered = expenses.filter(exp => {
        if (!isBetween(exp.date, args.startDate, args.endDate)) return false;
        if (args.category && exp.category?.toLowerCase() !== args.category.toLowerCase()) return false;
        if (args.minAmount !== undefined && exp.amount < args.minAmount) return false;
        if (args.maxAmount !== undefined && exp.amount > args.maxAmount) return false;
        if (args.vendor && !exp.vendor.toLowerCase().includes(args.vendor.toLowerCase())) return false;
        return true;
    });

    if (args.excludeAnomalies) {
        const anomalies = detectAnomalies(filtered, 2); // Using 2 as threshold multiplier
        filtered = filtered.filter(exp => !anomalies.includes(exp));
    }

    return filtered;
};

export const createTools = (expenses: Expense[]) => ({
    filter_expenses: tool({
        description: `Returns a list of expenses matching specific criteria. Use this when the user wants to see specific transactions.`,
        inputSchema: z.object({
            startDate: z.string().optional().describe('Filter by start date (YYYY-MM-DD)'),
            endDate: z.string().optional().describe('Filter by end date (YYYY-MM-DD)'),
            category: z.string().optional().describe('Filter by category'),
            minAmount: z.number().optional().describe('Minimum amount'),
            maxAmount: z.number().optional().describe('Maximum amount'),
            vendor: z.string().optional().describe('Filter by vendor name'),
            excludeAnomalies: z.boolean().optional().describe('Whether to exclude anomalies/outliers')
        }),
        execute: async (args) => {
            return filterLogic(expenses, args || {});
        }
    }),

    calculate_statistics: tool({
        description: `Calculates a single metric (sum, mean, median, min, max, count) for a filtered set of expenses.`,
        inputSchema: z.object({
            metric: z.enum(['sum', 'mean', 'median', 'min', 'max', 'count']).describe('The metric to calculate'),
            startDate: z.string().optional().describe('Filter by start date (YYYY-MM-DD)'),
            endDate: z.string().optional().describe('Filter by end date (YYYY-MM-DD)'),
            category: z.string().optional().describe('Filter by category'),
            minAmount: z.number().optional().describe('Minimum amount'),
            maxAmount: z.number().optional().describe('Maximum amount'),
            excludeAnomalies: z.boolean().optional().describe('Whether to exclude anomalies/outliers')
        }),
        execute: async (args) => {
            const { metric, ...filterArgs } = args || {};
            const filtered = filterLogic(expenses, filterArgs);
            if (filtered.length === 0) return 0;
            const amounts = filtered.map(e => e.amount);

            switch (metric) {
                case 'sum': return math.sum(amounts);
                case 'mean': return math.mean(amounts);
                case 'median': return math.median(amounts);
                case 'min': return math.min(amounts);
                case 'max': return math.max(amounts);
                case 'count': return filtered.length;
                default: return 0;
            }
        }
    }),

    aggregate_expenses: tool({
        description: `Groups expenses by category, vendor, or month and calculates a metric (sum, count, mean) for each group.`,
        inputSchema: z.object({
            groupBy: z.enum(['category', 'vendor', 'month']).describe('Field to group by'),
            metric: z.enum(['sum', 'count', 'mean']).describe('Metric to calculate for each group'),
            startDate: z.string().optional().describe('Filter by start date (YYYY-MM-DD)'),
            endDate: z.string().optional().describe('Filter by end date (YYYY-MM-DD)'),
            category: z.string().optional().describe('Filter by category'),
            excludeAnomalies: z.boolean().optional().describe('Whether to exclude anomalies/outliers')
        }),
        execute: async (args) => {
            const { groupBy, metric, ...filterArgs } = args || {};
            const filtered = filterLogic(expenses, filterArgs);
            const groups: Record<string, number[]> = {};

            filtered.forEach(exp => {
                let key = '';
                if (groupBy === 'category') key = exp.category || 'Uncategorized';
                else if (groupBy === 'vendor') key = exp.vendor;
                else if (groupBy === 'month') key = exp.date.substring(0, 7); // YYYY-MM

                if (!groups[key]) groups[key] = [];
                groups[key].push(exp.amount);
            });

            const result: Record<string, number> = {};
            for (const key in groups) {
                const amounts = groups[key];
                if (metric === 'sum') result[key] = math.sum(amounts);
                else if (metric === 'count') result[key] = amounts.length;
                else if (metric === 'mean') result[key] = math.mean(amounts);
            }

            return result;
        }
    })
});