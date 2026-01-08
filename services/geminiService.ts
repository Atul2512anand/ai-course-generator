import { GoogleGenAI, Type } from "@google/genai";
import { CourseLevel, Course } from "../types";

// Schema for structured output
const lessonSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title of the lesson" },
    content: { type: Type.STRING, description: "Detailed educational content, explanation, and key concepts. Min 100 words." },
    youtubeQuery: { type: Type.STRING, description: "A specific search query to find a relevant YouTube tutorial for this lesson" },
    codeSnippet: { type: Type.STRING, description: "Optional code example if technical, otherwise null" },
  },
  required: ["title", "content", "youtubeQuery"],
};

const quizSchema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: "The multiple choice question" },
    options: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Array of 4 possible answers"
    },
    correctAnswer: { type: Type.INTEGER, description: "The 0-based index of the correct option" },
    explanation: { type: Type.STRING, description: "Brief explanation of why the answer is correct" }
  },
  required: ["question", "options", "correctAnswer"]
};

const moduleSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title of the module" },
    lessons: {
      type: Type.ARRAY,
      items: lessonSchema,
    },
    quiz: {
      type: Type.ARRAY,
      items: quizSchema,
      description: "1-2 multiple choice questions to test understanding of this module"
    }
  },
  required: ["title", "lessons", "quiz"],
};

const courseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A catchy and professional title for the course" },
    modules: {
      type: Type.ARRAY,
      items: moduleSchema,
    },
  },
  required: ["title", "modules"],
};

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor(apiKey: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async generateCourse(topic: string, level: CourseLevel, durationHours: number): Promise<Omit<Course, 'id' | 'createdAt' | 'topic' | 'level' | 'duration'>> {
    if (!this.ai) throw new Error("Gemini API Key is missing.");

    const prompt = `
      Create a comprehensive ${durationHours}-hour course on "${topic}" for ${level} level students.
      Structure the course into logical modules and detailed lessons.
      Ensure the content is educational, accurate, and ready for a learning platform.
      For each lesson, provide a specific YouTube search query that would yield a good video tutorial.
      For each module, include 1-2 Multiple Choice Questions (Quiz) to test the student's knowledge.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: courseSchema,
          systemInstruction: "You are an expert curriculum developer and educator.",
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini.");

      const data = JSON.parse(text);
      return data;
    } catch (error) {
      console.error("Gemini Generation Error:", error);
      throw error;
    }
  }
}
