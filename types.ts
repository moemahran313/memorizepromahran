
export interface Concept {
  id: string;
  term: string;
  explanation: string;
  testLikelihood: 'High' | 'Medium' | 'Low';
}

export interface Mnemonic {
  conceptId: string;
  term: string;
  aid: string; // Acronym, phrase, or association
  visualHook: string; // Vivid mental image description
}

export interface Equation {
  id: string;
  term: string;
  formula: string;
  explanation: string;
}

export interface Law {
  id: string;
  name: string;
  statement: string;
  application: string;
}

export interface VisualAids {
  id: string;
  description: string;
  summary: string;
  mentalImage: string; // Step-by-step mental image/visual mnemonic for the diagram
}

export interface FlowchartNode {
  id: string;
  label: string;
  description: string;
  next?: string[];
}

export interface SpacedPlan {
  core: string[];
  supporting: string[];
  examples: string[];
  schedule: {
    day: number;
    focus: string;
    tasks: string[];
  }[];
}

export interface StudyData {
  concepts: Concept[];
  mnemonics: Mnemonic[];
  plan: SpacedPlan;
  equations?: Equation[];
  laws?: Law[];
  visualAids?: VisualAids[];
  flowchart?: FlowchartNode[];
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'short-answer' | 'explain';
  question: string;
  options?: string[];
  correctAnswer: string;
  hint?: string;
  conceptId: string;
}

export interface QuizFeedback {
  isCorrect: boolean;
  message: string;
  correction?: string;
  memoryTip?: string;
}

export interface User {
  id: string;
  username: string;
  weakAreas: string[]; // Concept IDs
  quizHistory: { date: string; score: number; total: number }[];
}

export type AppMode = 'landing' | 'processing' | 'dashboard' | 'quiz' | 'exam' | 'auth';
export type DashboardTab = 'concepts' | 'flashcards' | 'formulas' | 'visuals' | 'tutor';
