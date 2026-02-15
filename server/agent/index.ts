import { generateText, CoreMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { Expense } from './types';
import { SYSTEM_PROMPT } from './systemPrompt';
import { createTools } from '../tools';

export class FinanceAgent {
  private expenses: Expense[];
  private messages: CoreMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  constructor(expenses: Expense[]) {
    this.expenses = expenses;
  }

  async run(query: string): Promise<string> {
    console.log("Running agent with query:", query);

    return "test";
    this.messages.push({ role: 'user', content: query });
    const tools = createTools(this.expenses);

    let steps = 0;
    const maxSteps = 10;

    while (steps < maxSteps) {
      const result = await generateText({
        model: google('gemini-2.5-flash'),
        messages: this.messages as any, // Cast to avoid strict type issues while debugging
        tools,
      });

      if (result.finishReason === 'tool-calls') {
        const toolCalls = result.toolCalls;

        // Add model's tool calls to messages
        this.messages.push({
          role: 'assistant',
          content: toolCalls.map(tc => ({
            type: 'tool-call',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          })),
        } as any);

        // Execute tools and add results to messages
        for (const toolCall of toolCalls) {
          const tool = (tools as any)[toolCall.toolName];
          if (tool) {
            const toolResult = await tool.execute(toolCall.args);
            this.messages.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: toolResult,
                },
              ],
            } as any);
          }
        }
        steps++;
        continue;
      }

      // Finish reason is 'stop' or similar
      const responseText = result.text;
      this.messages.push({ role: 'assistant', content: responseText });
      return responseText;
    }

    return "I'm sorry, I reached my maximum processing limit for this request.";
  }
}
