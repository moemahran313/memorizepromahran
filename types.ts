
export type LearningStyle = 'visual' | 'verbal' | 'mixed';
export type MnemonicPref = 'acronyms' | 'stories' | 'images' | 'diagrams';

export interface UserProfile {
  subject: string;
  academicLevel: string;
  learningStyle: LearningStyle;
  mnemonicPref: MnemonicPref;
  examDate?: string;
  dailyTimeLimit?: number; // minutes
}

export interface User {
  id: string;
  username: string;
  profile: UserProfile;
  weakAreas: string[]; // Concept IDs
  quizHistory: { date: string; score: number; total: number; sheetId: string }[];
  library: string[]; // Sheet IDs
  conceptMastery: Record<string, number>; // Maps ConceptID -> Mastery % (0-100)
}

export interface Concept {
  id: string;
  term: string;
  explanation: string;
  testLikelihood: 'High' | 'Medium' | 'Low';
  relatedConceptIds: string[]; // Linked concepts for navigation
}

export interface Mnemonic {
  conceptId: string;
  term: string;
  aid: string; 
  visualHook: string;
}

export interface Equation {
  id: string;
  term: string;
  formula: string; // LaTeX
  plainEnglish: string;
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
  mentalImage: string;
}

export interface FlowchartNode {
  id: string;
  label: string;
  description: string;
  next?: string[];
}

export interface SpacedPlan {
  core?: string[];
  supporting?: string[];
  examples?: string[];
  schedule: {
    day: number;
    focus: string;
    tasks: string[];
  }[];
}

export interface StudyData {
  id: string; 
  title: string;
  concepts: Concept[];
  mnemonics: Mnemonic[];
  plan: SpacedPlan;
  equations?: Equation[];
  laws?: Law[];
  visualAids?: VisualAids[];
  flowchart?: FlowchartNode[];
}

export interface SharedSheet {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  subject: string;
  level: string;
  data: StudyData;
  ratings: { userId: string; score: number }[];
  comments: { userId: string; userName: string; text: string; date: string }[];
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

export type AppMode = 'landing' | 'processing' | 'dashboard' | 'quiz' | 'exam' | 'auth' | 'profile' | 'network';
export type DashboardTab = 'concepts' | 'flashcards' | 'formulas' | 'visuals' | 'tutor';
