import type { NodeDefinition } from './types.js';

/**
 * The built-in node catalog. Adding a new node = add a definition here and a
 * handler in the engine's node registry (internal SDK pattern).
 */
export const NODE_CATALOG: NodeDefinition[] = [
  {
    type: 'input.text',
    category: 'input',
    label: 'Text Input',
    labelAr: 'إدخال نص',
    description: 'Provides a static text value or run input to the flow.',
    descriptionAr: 'يوفّر قيمة نصية ثابتة أو مُدخل تشغيل للتدفق.',
    inputs: [],
    outputs: ['text'],
    params: [
      { key: 'value', label: 'Value', labelAr: 'القيمة', type: 'text', placeholder: 'Static text, or leave empty to use run input' },
      { key: 'inputKey', label: 'Run input key', labelAr: 'مفتاح مُدخل التشغيل', type: 'string', placeholder: 'e.g. message' }
    ]
  },
  {
    type: 'trigger.webhook',
    category: 'input',
    label: 'Webhook Trigger',
    labelAr: 'مشغّل Webhook',
    description: 'Starts the flow when the workflow webhook URL is called; outputs the request payload.',
    descriptionAr: 'يبدأ التدفق عند استدعاء رابط الـ Webhook الخاص بالتدفق؛ يُخرج حمولة الطلب.',
    inputs: [],
    outputs: ['payload'],
    params: []
  },
  {
    type: 'ai.llm',
    category: 'ai',
    label: 'AI Model (LLM)',
    labelAr: 'نموذج ذكاء اصطناعي',
    description: 'Sends a prompt to an LLM (OpenAI-compatible API) and outputs the completion.',
    descriptionAr: 'يرسل موجّهًا إلى نموذج لغوي (واجهة متوافقة مع OpenAI) ويُخرج الإجابة.',
    inputs: ['context'],
    outputs: ['completion'],
    params: [
      { key: 'model', label: 'Model', labelAr: 'النموذج', type: 'string', default: 'gpt-4o-mini' },
      { key: 'prompt', label: 'Prompt', labelAr: 'الموجّه', type: 'text', required: true, placeholder: 'Use {{context}} to insert upstream data' },
      { key: 'apiBase', label: 'API base URL', labelAr: 'رابط الواجهة', type: 'string', default: 'https://api.openai.com/v1' }
    ]
  },
  {
    type: 'ai.summarize',
    category: 'ai',
    label: 'Summarize',
    labelAr: 'تلخيص',
    description: 'Summarizes the input text using an LLM.',
    descriptionAr: 'يلخّص النص المُدخل باستخدام نموذج لغوي.',
    inputs: ['text'],
    outputs: ['summary'],
    params: [
      { key: 'model', label: 'Model', labelAr: 'النموذج', type: 'string', default: 'gpt-4o-mini' },
      { key: 'language', label: 'Output language', labelAr: 'لغة المخرجات', type: 'select', options: ['auto', 'ar', 'en'], default: 'auto' }
    ]
  },
  {
    type: 'web.http',
    category: 'web',
    label: 'HTTP Request',
    labelAr: 'طلب HTTP',
    description: 'Performs an HTTP request and outputs the response body.',
    descriptionAr: 'ينفّذ طلب HTTP ويُخرج جسم الاستجابة.',
    inputs: ['body'],
    outputs: ['response', 'status'],
    params: [
      { key: 'url', label: 'URL', labelAr: 'الرابط', type: 'string', required: true },
      { key: 'method', label: 'Method', labelAr: 'الطريقة', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      { key: 'headers', label: 'Headers (JSON)', labelAr: 'الترويسات (JSON)', type: 'json', default: '{}' }
    ]
  },
  {
    type: 'logic.condition',
    category: 'logic',
    label: 'Condition (If/Else)',
    labelAr: 'شرط (إذا/وإلا)',
    description: 'Routes data to "true" or "false" output based on a comparison.',
    descriptionAr: 'يوجّه البيانات إلى مخرج "صحيح" أو "خاطئ" بناءً على مقارنة.',
    inputs: ['value'],
    outputs: ['true', 'false'],
    params: [
      { key: 'operator', label: 'Operator', labelAr: 'المُعامل', type: 'select', options: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'], default: 'equals', required: true },
      { key: 'compareTo', label: 'Compare to', labelAr: 'المقارنة مع', type: 'string', required: true }
    ]
  },
  {
    type: 'logic.code',
    category: 'logic',
    label: 'Custom Code (JS)',
    labelAr: 'كود مخصص (JS)',
    description: 'Runs sandboxed JavaScript. `input` holds upstream values; return the output object.',
    descriptionAr: 'يشغّل JavaScript في بيئة معزولة. `input` يحمل قيم العُقد السابقة؛ أعد كائن المخرجات.',
    inputs: ['input'],
    outputs: ['result'],
    params: [
      { key: 'code', label: 'Code', labelAr: 'الكود', type: 'text', required: true, default: 'return { result: input };' }
    ]
  },
  {
    type: 'data.template',
    category: 'logic',
    label: 'Template',
    labelAr: 'قالب نصي',
    description: 'Builds a string from a template with {{placeholders}} filled from inputs.',
    descriptionAr: 'يبني نصًا من قالب يحتوي على {{متغيرات}} تُملأ من المدخلات.',
    inputs: ['data'],
    outputs: ['text'],
    params: [
      { key: 'template', label: 'Template', labelAr: 'القالب', type: 'text', required: true, placeholder: 'Hello {{data}}' }
    ]
  },
  {
    type: 'output.email',
    category: 'output',
    label: 'Send Email',
    labelAr: 'إرسال بريد',
    description: 'Sends an email via SMTP-compatible relay (logged in dev mode).',
    descriptionAr: 'يرسل بريدًا إلكترونيًا عبر مرحّل SMTP (يُسجَّل فقط في وضع التطوير).',
    inputs: ['body'],
    outputs: ['sent'],
    params: [
      { key: 'to', label: 'To', labelAr: 'إلى', type: 'string', required: true },
      { key: 'subject', label: 'Subject', labelAr: 'الموضوع', type: 'string', required: true }
    ]
  },
  {
    type: 'output.log',
    category: 'output',
    label: 'Log Output',
    labelAr: 'تسجيل المخرجات',
    description: 'Records its input as the final output of the run.',
    descriptionAr: 'يسجّل مدخله كمخرج نهائي للتشغيل.',
    inputs: ['value'],
    outputs: ['value'],
    params: [
      { key: 'label', label: 'Label', labelAr: 'التسمية', type: 'string', default: 'output' }
    ]
  }
];

export const NODE_CATALOG_BY_TYPE: Record<string, NodeDefinition> = Object.fromEntries(
  NODE_CATALOG.map((definition) => [definition.type, definition])
);
