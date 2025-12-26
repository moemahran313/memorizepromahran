
import { GoogleGenAI, Type } from "@google/genai";
import { StudyData, QuizQuestion, QuizFeedback } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const processStudyMaterial = async (fileBase64: string, mimeType: string): Promise<StudyData> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType
            }
          },
          {
            text: `Analyze this study material and extract core knowledge for rapid, long-term memorization. 
            Follow these scientifically-backed learning rules:
            
            1. Concepts: Extract terms with simple, clear explanations and highlight test likelihood.
            2. Equations/Laws: Extract formulas and official scientific principles.
            3. Mnemonics & Memory Tools: 
               - For every important concept, create a mnemonic (acronym, phrase, or word association).
               - Provide a "Visual Memory Hook": Describe a vivid, specific mental image to imagine that represents the concept.
            4. Image/Diagram Analysis: 
               - If images or diagrams exist, provide a summary of what they show in simple terms.
               - Turn diagrams into a "Visual Mnemonic": A step-by-step mental image that walks the student through the process shown.
            5. Spaced Learning: Organize a 3-day repetition schedule.
            6. Processes: Represent key cycles/steps as a flowchart structure.
            
            Return the result in JSON format.`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          concepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                term: { type: Type.STRING },
                explanation: { type: Type.STRING },
                testLikelihood: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
              },
              required: ['id', 'term', 'explanation', 'testLikelihood']
            }
          },
          equations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                term: { type: Type.STRING },
                formula: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ['id', 'term', 'formula', 'explanation']
            }
          },
          laws: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                statement: { type: Type.STRING },
                application: { type: Type.STRING }
              },
              required: ['id', 'name', 'statement', 'application']
            }
          },
          visualAids: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                description: { type: Type.STRING },
                summary: { type: Type.STRING },
                mentalImage: { type: Type.STRING, description: "A step-by-step mental image mnemonic for the diagram" }
              },
              required: ['id', 'description', 'summary', 'mentalImage']
            }
          },
          mnemonics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                conceptId: { type: Type.STRING },
                term: { type: Type.STRING },
                aid: { type: Type.STRING, description: "The acronym or phrase" },
                visualHook: { type: Type.STRING, description: "Specific vivid image to imagine" }
              },
              required: ['conceptId', 'term', 'aid', 'visualHook']
            }
          },
          plan: {
            type: Type.OBJECT,
            properties: {
              core: { type: Type.ARRAY, items: { type: Type.STRING } },
              supporting: { type: Type.ARRAY, items: { type: Type.STRING } },
              examples: { type: Type.ARRAY, items: { type: Type.STRING } },
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.NUMBER },
                    focus: { type: Type.STRING },
                    tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          },
          flowchart: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                next: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['id', 'label', 'description']
            }
          }
        },
        required: ['concepts', 'mnemonics', 'plan']
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateQuizQuestions = async (studyData: StudyData, weakConcepts: string[] = []): Promise<QuizQuestion[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 10 adaptive quiz questions based on this study material: ${JSON.stringify(studyData)}. 
    Include questions about specific equations, laws, and visual concepts extracted.
    Heavily prioritize testing these weak concepts if provided: ${weakConcepts.join(', ')}.
    Include:
    - 4 Multiple Choice
    - 3 Short Answer
    - 3 "Explain in your own words" (conceptual check)
    Make them progressively harder.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['multiple-choice', 'short-answer', 'explain'] },
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            hint: { type: Type.STRING },
            conceptId: { type: Type.STRING }
          },
          required: ['id', 'type', 'question', 'correctAnswer', 'conceptId']
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const gradeAnswer = async (question: QuizQuestion, userAnswer: string): Promise<QuizFeedback> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Grade this answer for the question: "${question.question}". 
    The correct answer is: "${question.correctAnswer}". 
    The user provided: "${userAnswer}".
    Provide immediate feedback, a correction if wrong, and a memory tip.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          message: { type: Type.STRING },
          correction: { type: Type.STRING },
          memoryTip: { type: Type.STRING }
        },
        required: ['isCorrect', 'message', 'memoryTip']
      }
    }
  });

  return JSON.parse(response.text);
};

export const askTutoring = async (concept: string, context: string, question: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are an AI Study Tutor. A student is asking about the concept: "${concept}".
    Context from study material: "${context}".
    User Question: "${question}".
    Explain in a way that helps with long-term memorization. Break down complex ideas and use analogies.`,
  });
  return response.text || "I'm sorry, I couldn't generate an explanation right now.";
};
