import api from "./api";

export interface AiHelpResponse {
  success: boolean;
  answer: string;
  engine?: string;
  model?: string;
  error?: string;
}

export const aiHelpService = {
  async askHelp(question: string): Promise<AiHelpResponse> {
    try {
      const response = await api.post("/ai/ask-help", { question });
      return response.data;
    } catch (err: any) {
      console.warn("AI Help request error, falling back locally:", err);
      return {
        success: true,
        answer: "Hello! For immediate guidance, please refer to the Knowledge Base FAQ tabs or click **Raise Ticket** below to connect with your Coordinator.",
        engine: "local-fallback"
      };
    }
  }
};
