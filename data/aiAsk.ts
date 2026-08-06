export interface AskAIRequest {
  question: string;
  context: {
    tab?: string;
    amount?: number;
    risk?: number;
    time?: string;
  };
  client?: {
    app: string;
    version: string;
  };
}

export interface AskAIResponse {
  question: string;
  meta: any;
  summary: string;
  bullets: string[];
  chips: { label: string; tone: string }[];
  next_action: {
    product: string;
    suggested: { amount: number; risk: number; duration: { value: number; unit: string } };
  };
}
