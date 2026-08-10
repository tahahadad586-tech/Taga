import { createContext, runInContext } from 'node:vm';
import type { HandlerRegistry, NodeContext } from './executor.js';

export interface HandlerOptions {
  /** API key for OpenAI-compatible LLM endpoints. */
  llmApiKey?: string;
  /** When true, output nodes only log instead of performing side effects. */
  devMode?: boolean;
}

function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, values);
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

async function callLlm(
  apiBase: string,
  apiKey: string | undefined,
  model: string,
  prompt: string
): Promise<string> {
  if (!apiKey) {
    // Dev fallback: deterministic echo so flows are testable without a key.
    return `[dev-llm:${model}] ${prompt.slice(0, 400)}`;
  }
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
  });
  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Builds the default handler registry (the internal node SDK). */
export function createDefaultHandlers(options: HandlerOptions = {}): HandlerRegistry {
  const { llmApiKey, devMode = true } = options;

  return {
    'input.text': async ({ params, runInput }: NodeContext) => {
      const inputKey = typeof params.inputKey === 'string' ? params.inputKey : '';
      const fromRun = inputKey ? runInput[inputKey] : undefined;
      const value = fromRun ?? params.value ?? '';
      return { text: typeof value === 'string' ? value : JSON.stringify(value) };
    },

    'trigger.webhook': async ({ runInput }: NodeContext) => {
      return { payload: runInput };
    },

    'ai.llm': async ({ inputs, params }: NodeContext) => {
      const prompt = renderTemplate(String(params.prompt ?? ''), {
        context: inputs.context ?? inputs.input ?? '',
        ...inputs
      });
      const completion = await callLlm(
        String(params.apiBase ?? 'https://api.openai.com/v1'),
        llmApiKey,
        String(params.model ?? 'gpt-4o-mini'),
        prompt
      );
      return { completion };
    },

    'ai.summarize': async ({ inputs, params }: NodeContext) => {
      const text = String(inputs.text ?? inputs.input ?? '');
      const language = String(params.language ?? 'auto');
      const langInstruction =
        language === 'ar' ? 'أجب بالعربية. ' : language === 'en' ? 'Answer in English. ' : '';
      const summary = await callLlm(
        String(params.apiBase ?? 'https://api.openai.com/v1'),
        llmApiKey,
        String(params.model ?? 'gpt-4o-mini'),
        `${langInstruction}Summarize the following text concisely:\n\n${text}`
      );
      return { summary };
    },

    'web.http': async ({ inputs, params }: NodeContext) => {
      const method = String(params.method ?? 'GET').toUpperCase();
      let headers: Record<string, string> = {};
      if (params.headers) {
        headers =
          typeof params.headers === 'string'
            ? (JSON.parse(params.headers) as Record<string, string>)
            : (params.headers as Record<string, string>);
      }
      const body =
        method === 'GET' || inputs.body === undefined
          ? undefined
          : typeof inputs.body === 'string'
            ? inputs.body
            : JSON.stringify(inputs.body);
      if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      const response = await fetch(String(params.url), { method, headers, body });
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep raw text */
      }
      return { response: parsed, status: response.status };
    },

    'logic.condition': async ({ inputs, params }: NodeContext) => {
      const value = inputs.value ?? inputs.input;
      const compareTo = params.compareTo;
      const operator = String(params.operator ?? 'equals');
      let result: boolean;
      switch (operator) {
        case 'equals':
          result = String(value) === String(compareTo);
          break;
        case 'not_equals':
          result = String(value) !== String(compareTo);
          break;
        case 'contains':
          result = String(value).includes(String(compareTo));
          break;
        case 'greater_than':
          result = Number(value) > Number(compareTo);
          break;
        case 'less_than':
          result = Number(value) < Number(compareTo);
          break;
        default:
          throw new Error(`Unknown operator "${operator}"`);
      }
      return result ? { true: value } : { false: value };
    },

    'logic.code': async ({ inputs, params }: NodeContext) => {
      const code = String(params.code ?? 'return { result: input };');
      const input = inputs.input ?? inputs;
      const sandbox = createContext({ input: structuredClone(input) }, { codeGeneration: { strings: false, wasm: false } });
      const result = runInContext(`(function(){ ${code} })()`, sandbox, { timeout: 2000 });
      const output = result && typeof result === 'object' ? (result as Record<string, unknown>) : { result };
      return output;
    },

    'data.template': async ({ inputs, params }: NodeContext) => {
      const text = renderTemplate(String(params.template ?? ''), {
        data: inputs.data ?? inputs.input ?? '',
        ...inputs
      });
      return { text };
    },

    'output.email': async ({ inputs, params }: NodeContext) => {
      const message = {
        to: String(params.to ?? ''),
        subject: String(params.subject ?? ''),
        body: String(inputs.body ?? inputs.input ?? '')
      };
      if (devMode) {
        // In dev mode the email is recorded in the run log instead of being sent.
        return { sent: false, devMode: true, message };
      }
      throw new Error('SMTP relay is not configured; set devMode or configure an email provider');
    },

    'output.log': async ({ inputs, params }: NodeContext) => {
      const label = String(params.label ?? 'output');
      return { value: inputs.value ?? inputs.input ?? null, label };
    }
  };
}
