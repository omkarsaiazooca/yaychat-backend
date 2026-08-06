import { AskAIRequest, AskAIResponse } from "./aiAsk";

export interface AiAnswer extends AskAIResponse {
  createdAt?: Date;
  request?: AskAIRequest; // optional, for auditing input
}
