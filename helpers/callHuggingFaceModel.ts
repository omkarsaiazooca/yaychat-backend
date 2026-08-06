import axios from "axios";

const HF_API = "https://api-inference.huggingface.co/models/bitext/Mistral-7B-Wealth_Management-v1";
const HF_KEY = process.env.HF_API_KEY; // optional

export async function callHuggingFaceModel(prompt: string): Promise<string> {
    try {
        const res = await axios.post(
            HF_API,
            { inputs: prompt },
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(HF_KEY && { Authorization: `Bearer ${HF_KEY}` }),
                },
            }
        );

        const data = res.data;
        return data[0]?.generated_text || "No answer generated.";
    } catch (err: any) {
        console.error("HF API Error:", err.response?.data || err.message);
        return "AI service unavailable.";
    }
}