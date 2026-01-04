
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GeneratedScript } from "../types";
import { MODEL_NAMES, SYSTEM_PROMPT, VOICE_CONFIG } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateScriptFromText(notesText: string): Promise<GeneratedScript> {
    if (!notesText.trim()) {
      throw new Error("Notes content is empty.");
    }

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAMES.TEXT,
        contents: `Here are the notes: \n\n${notesText}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 16000 },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING, enum: ["Lukas", "Felix"] },
                    german: { type: Type.STRING },
                    stageDirection: { type: Type.STRING },
                    english: { type: Type.STRING },
                  },
                  required: ["speaker", "german", "english"],
                },
              },
            },
            required: ["topic", "lines"],
          },
        },
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("No response from model");
      
      return JSON.parse(jsonText) as GeneratedScript;
    } catch (error) {
      console.error("Script generation error:", error);
      throw error;
    }
  }

  async generateAudio(script: GeneratedScript): Promise<string> {
    // We pass the stage directions directly into the TTS prompt to influence the performance.
    const dialogueString = script.lines
      .map((line) => `${line.speaker} [Direction: ${line.stageDirection}]: ${line.german}`)
      .join('\n');

    const prompt = `Perform this German audio drama with MAXIMUM emotional fidelity and organic texture. 
    Lukas is the grounded, steady anchor with a warm gravitas. 
    Felix is the deep, alluring spark—playful, sexy, and dynamic.
    
    STRICTLY follow the stage directions in brackets to modulate your tone, speed, and emotion. 
    Incorporate all non-verbal cues (sighs, chuckles, breaths) to avoid any metallic or robotic feel.
    
    Dialogue:
    ${dialogueString}`;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAMES.TTS,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Lukas',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: VOICE_CONFIG.Lukas }
                  }
                },
                {
                  speaker: 'Felix',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: VOICE_CONFIG.Felix }
                  }
                }
              ]
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio data returned from API");
      }
      return base64Audio;

    } catch (error) {
      console.error("Audio generation error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
