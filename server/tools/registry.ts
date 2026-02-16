import { Expense } from '../agent/types';
import { detectAnomalies } from '../utils/anomaly-helper';
import { isBetween } from '../utils/date-helpers';
import { groupBy } from '../utils/array-helpers';
import * as math from '../utils/math-helpers';

type ExpenseFilter = {
  startDate?: string;
  endDate?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  vendor?: string;
  excludeAnomalies?: boolean;
};

type StatsInput = ExpenseFilter & {
  metric: 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count';
};

type AggregateInput = ExpenseFilter & {
  groupBy: 'category' | 'vendor' | 'month';
  metric: 'sum' | 'count' | 'mean' | 'median';
};

const round2 = (value: number): number => Number(value.toFixed(2));

const filterExpenses = (expenses: Expense[], args: ExpenseFilter): Expense[] => {
  const filtered = expenses.filter((expense) => {
    if (!isBetween(expense.date, args.startDate, args.endDate)) return false;
    if (args.category && expense.category?.toLowerCase() !== args.category.toLowerCase()) return false;
    if (args.minAmount !== undefined && expense.amount < args.minAmount) return false;
    if (args.maxAmount !== undefined && expense.amount > args.maxAmount) return false;
    if (args.vendor && !expense.vendor.toLowerCase().includes(args.vendor.toLowerCase())) return false;
    return true;
  });

  if (!args.excludeAnomalies || filtered.length < 2) {
    return filtered;
  }

  const anomalies = new Set(detectAnomalies(filtered, 2));
  return filtered.filter((expense) => !anomalies.has(expense));
};

const runFilterTool = async (expenses: Expense[], args: ExpenseFilter) => {
  const filtered = filterExpenses(expenses, args);
  return {
    metadata: {
      totalMatching: filtered.length,
      filter: args
    },
    expenses: filtered
  };
};

const runStatsTool = async (expenses: Expense[], args: StatsInput) => {
  const { metric, ...filterArgs } = args;
  const filtered = filterExpenses(expenses, filterArgs);

  if (metric === 'count') {
    return {
      metric,
      value: filtered.length,
      count: filtered.length,
      filter: filterArgs
    };
  }

  const amounts = filtered.map((expense) => expense.amount);
  if (amounts.length === 0) {
    return {
      metric,
      value: 0,
      count: 0,
      filter: filterArgs
    };
  }

  let value = 0;
  switch (metric) {
    case 'sum':
      value = math.sum(amounts);
      break;
    case 'mean':
      value = math.mean(amounts);
      break;
    case 'median':
      value = math.median(amounts);
      break;
    case 'min':
      value = math.min(amounts);
      break;
    case 'max':
      value = math.max(amounts);
      break;
    default:
      value = 0;
      break;
  }

  return {
    metric,
    value: round2(value),
    count: filtered.length,
    filter: filterArgs
  };
};

const runAggregateTool = async (expenses: Expense[], args: AggregateInput) => {
  const { groupBy: groupingKey, metric, ...filterArgs } = args;
  const filtered = filterExpenses(expenses, filterArgs);

  const grouped = groupBy(filtered, (expense) => {
    if (groupingKey === 'category') return expense.category ?? 'Uncategorized';
    if (groupingKey === 'vendor') return expense.vendor;
    return expense.date.slice(0, 7);
  });

  const entries = Object.entries(grouped).map(([key, group]) => {
    const amounts = group.map((expense) => expense.amount);

    let value = 0;
    switch (metric) {
      case 'sum':
        value = math.sum(amounts);
        break;
      case 'count':
        value = amounts.length;
        break;
      case 'mean':
        value = math.mean(amounts);
        break;
      case 'median':
        value = math.median(amounts);
        break;
      default:
        value = 0;
        break;
    }

    return { key, value: round2(value), count: group.length };
  });

  entries.sort((a, b) => b.value - a.value);

  return {
    groupBy: groupingKey,
    metric,
    count: filtered.length,
    filter: filterArgs,
    entries
  };
};

export const toolFunctions = {
  filter_expenses: runFilterTool,
  calculate_statistics: runStatsTool,
  aggregate_expenses: runAggregateTool
};

