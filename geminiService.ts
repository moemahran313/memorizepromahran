
import { GoogleGenAI, Type } from "@google/genai";
import { StudyData, QuizQuestion, QuizFeedback, UserProfile } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const processStudyMaterial = async (
  fileBase64: string, 
  mimeType: string, 
  profile: UserProfile
): Promise<StudyData> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
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
            text: `Act as a senior educational specialist. Analyze this study material and transform it into a high-performance cognitive mastery engine.
            
            User Context: ${profile.academicLevel} level, Subject: ${profile.subject}, Learning Style: ${profile.learningStyle}, Mnemonic Pref: ${profile.mnemonicPref}.
            
            CRITICAL: MATHEMATICAL FORMATTING RULES
            1. Use ONLY KaTeX-compatible LaTeX.
            2. DELIMITERS: 
               - Inline math: Wrap in SINGLE dollar signs like $E=mc^2$.
               - Block math: Wrap in DOUBLE dollar signs like $$a^2 + b^2 = c^2$$.
            3. MULTI-LINE: NEVER use the 'align' environment. Use 'aligned' inside math mode, e.g., $$\\begin{aligned} x &= y \\\\ a &= b \\end{aligned}$$.
            4. SYMBOLS: Use standard \\frac{a}{b}, \\sqrt{x}, \\int, \\sum_{i=1}^{n}. For matrices use \\begin{pmatrix}...\\end{pmatrix}.
            5. Avoid any packages not native to KaTeX.
            
            KNOWLEDGE EXTRACTION RULES:
            1. Concepts: Provide deep, clear explanations.
            2. Related Concepts: For every concept, identify 2-3 other concept 'id's in the generated list that are logically related.
            3. Equations: For every formula, provide the LaTeX and a 'plainEnglish' verbal translation (e.g., "Force equals mass times acceleration").
            4. Mnemonics: Create vivid, memorable hooks using the user's preference.
            5. Visuals: Describe any diagrams/images as step-by-step mental models.
            6. Plan: A 3-day spaced repetition schedule.
            
            Return a JSON object matching the StudyData interface.`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          concepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                term: { type: Type.STRING },
                explanation: { type: Type.STRING },
                testLikelihood: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                relatedConceptIds: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['id', 'term', 'explanation', 'testLikelihood', 'relatedConceptIds']
            }
          },
          equations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                term: { type: Type.STRING },
                formula: { type: Type.STRING, description: "LaTeX using $ or $$ delimiters" },
                plainEnglish: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ['id', 'term', 'formula', 'plainEnglish', 'explanation']
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
                mentalImage: { type: Type.STRING }
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
                aid: { type: Type.STRING },
                visualHook: { type: Type.STRING }
              },
              required: ['conceptId', 'term', 'aid', 'visualHook']
            }
          },
          plan: {
            type: Type.OBJECT,
            properties: {
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.INTEGER },
                    focus: { type: Type.STRING },
                    tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['day', 'focus', 'tasks']
                }
              }
            },
            required: ['schedule']
          }
        },
        required: ['id', 'title', 'concepts', 'mnemonics', 'plan']
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateQuizQuestions = async (studyData: StudyData, weakConcepts: string[] = []): Promise<QuizQuestion[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Generate 10 adaptive recall questions for: ${studyData.title}.
    Weak Concepts for Focus: ${weakConcepts.join(', ')}.
    
    STRICT MATH RULE:
    - Use KaTeX $...$ for inline and $$...$$ for blocks.
    - No 'align', use 'aligned'.
    - Return a JSON array of QuizQuestion objects.`,
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
    contents: `Grade the student's answer.
    Question: "${question.question}"
    Correct Answer: "${question.correctAnswer}"
    Student Answer: "${userAnswer}"
    
    Rule: Use KaTeX $ or $$ for math in the feedback.
    Provide a concise memory tip for long-term retention.`,
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
    model: 'gemini-3-pro-preview',
    contents: `Tutor session for concept "${concept}".
    Background Knowledge: ${context}
    Student Query: "${question}"
    
    Requirement: Use KaTeX $...$ for all mathematical notation. Use analogies and avoid jargon where possible.`,
  });
  return response.text || "I'm sorry, I couldn't generate a response. Please try again.";
};
