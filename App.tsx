
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  BookOpen, BrainCircuit, Calendar, CheckCircle2, ChevronRight, FileText, Lightbulb, PlayCircle, RefreshCcw, Timer, Upload, X,
  AlertCircle, Layout, Layers, Network, MessageSquare, User as UserIcon, LogIn, ArrowRight, Send, Zap, Variable, Scale,
  Image as ImageIcon, Eye, Globe, ChevronDown, ChevronUp, Star, MessageCircle, Settings, LogOut, Search, Link as LinkIcon,
  Trophy, Target, Sparkles
} from 'lucide-react';
import { StudyData, AppMode, QuizQuestion, QuizFeedback, User, DashboardTab, Concept, SharedSheet, LearningStyle, MnemonicPref, Mnemonic } from './types';
import { processStudyMaterial, generateQuizQuestions, gradeAnswer, askTutoring } from './geminiService';

declare global {
  interface Window {
    katex: any;
  }
}

// --- Shared State Simulator ---
const DB = {
  getUsers: (): User[] => JSON.parse(localStorage.getItem('mp_users') || '[]'),
  saveUser: (user: User) => {
    const users = DB.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index > -1) users[index] = user;
    else users.push(user);
    localStorage.setItem('mp_users', JSON.stringify(users));
  },
  getCurrentUser: (): User | null => JSON.parse(localStorage.getItem('mp_current_user') || 'null'),
  setCurrentUser: (user: User | null) => localStorage.setItem('mp_current_user', JSON.stringify(user)),
  getNetwork: (): SharedSheet[] => JSON.parse(localStorage.getItem('mp_network') || '[]'),
};

// --- Advanced KaTeX Math Renderer ---
const MathRenderer: React.FC<{ text: string }> = ({ text }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  
  const renderMath = useCallback(() => {
    if (!containerRef.current || !window.katex) return;
    
    try {
      // Robust regex for $$...$$ and $...$
      // We handle block first, then inline to avoid collision
      let processed = text;
      
      // Block math: $$ ... $$
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
        try {
          return `<div class="my-6 text-center overflow-x-auto py-2 bg-slate-50/30 rounded-lg">${window.katex.renderToString(p1.trim(), { displayMode: true, throwOnError: false })}</div>`;
        } catch (e) { return match; }
      });
      
      // Inline math: $ ... $
      processed = processed.replace(/\$([\s\S]+?)\$/g, (match, p1) => {
        try {
          return `<span class="inline-math font-mono mx-0.5">${window.katex.renderToString(p1.trim(), { displayMode: false, throwOnError: false })}</span>`;
        } catch (e) { return match; }
      });

      containerRef.current.innerHTML = processed;
    } catch (e) {
      console.warn("Math rendering failed", e);
      containerRef.current.textContent = text;
    }
  }, [text]);

  useEffect(() => {
    // Retry a few times if katex isn't loaded yet (due to index.html scripts being defer)
    let tries = 0;
    const interval = setInterval(() => {
      if (window.katex) {
        renderMath();
        clearInterval(interval);
      }
      if (++tries > 10) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [renderMath]);

  return <span ref={containerRef} className="math-container leading-relaxed" />;
};

// --- Mastery Visualization Components ---
const MasteryProgress: React.FC<{ level: number; compact?: boolean }> = ({ level, compact }) => {
  const color = level >= 80 ? 'bg-emerald-500' : level >= 40 ? 'bg-indigo-500' : 'bg-amber-500';
  const shadow = level >= 80 ? 'shadow-emerald-200' : level >= 40 ? 'shadow-indigo-200' : 'shadow-amber-200';
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${level}%` }} />
        </div>
        <span className="text-[10px] font-black text-slate-400 w-8">{level}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Mastery Progress</span>
        <span>{level}%</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50 p-0.5">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-1000 ease-out shadow-sm ${shadow} ${level > 0 ? 'mastery-pulse' : ''}`} 
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  );
};

// --- UI Utility Components ---
const Button: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'indigo';
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}> = ({ onClick, children, variant = 'primary', className = '', disabled, type = "button" }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95',
    indigo: 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md',
    outline: 'bg-white text-slate-700 border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-md',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`px-5 py-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; id?: string }> = ({ children, className = '', onClick, id }) => (
  <div id={id} onClick={onClick} className={`bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 ${className}`}>
    {children}
  </div>
);

// --- Flashcards Component ---
const Flashcards: React.FC<{ concepts: Concept[]; mnemonics: Mnemonic[] }> = ({ concepts, mnemonics }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = concepts[index];
  const mnemonic = mnemonics.find(m => m.conceptId === current?.id);

  if (!current) return null;

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-12">
      <div 
        className="relative h-[450px] cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(!flipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-700`}
             style={{ 
               transformStyle: 'preserve-3d',
               transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
             }}>
          {/* Front */}
          <div className="absolute inset-0 bg-white rounded-[3.5rem] border-4 border-slate-100 shadow-2xl flex flex-col items-center justify-center p-12 text-center"
               style={{ backfaceVisibility: 'hidden' }}>
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em] mb-6">Active Recall</span>
            <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{current.term}</h3>
            <p className="mt-10 text-slate-300 font-black text-sm uppercase tracking-widest animate-pulse">Click to Reveal</p>
          </div>
          {/* Back */}
          <div className="absolute inset-0 bg-slate-900 rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center p-12 text-center text-white"
               style={{ 
                 backfaceVisibility: 'hidden',
                 transform: 'rotateY(180deg)'
               }}>
            <div className="max-w-md">
              <p className="text-2xl font-bold leading-relaxed mb-8">
                <MathRenderer text={current.explanation} />
              </p>
              {mnemonic && (
                <div className="bg-white/10 p-6 rounded-3xl border border-white/10 text-left">
                  <p className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-2">Memory Hook</p>
                  <p className="text-xl font-black italic">"{mnemonic.aid}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-10">
        <Button 
          variant="outline" 
          onClick={() => { setIndex(prev => Math.max(0, prev - 1)); setFlipped(false); }}
          disabled={index === 0}
          className="p-6 rounded-full"
        >
          <X className="w-8 h-8" />
        </Button>
        <div className="font-black text-2xl text-slate-400">
          {index + 1} <span className="text-slate-200">/</span> {concepts.length}
        </div>
        <Button 
          variant="indigo" 
          onClick={() => { setIndex(prev => Math.min(concepts.length - 1, prev + 1)); setFlipped(false); }}
          disabled={index === concepts.length - 1}
          className="p-6 rounded-full"
        >
          <ArrowRight className="w-8 h-8" />
        </Button>
      </div>
    </div>
  );
};

// --- Quiz View Component ---
const QuizView: React.FC<{ 
  questions: QuizQuestion[]; 
  isExam: boolean; 
  onComplete: (score: number, masteries: Record<string, number>) => void;
  onExit: () => void;
}> = ({ questions, isExam, onComplete, onExit }) => {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [masteries, setMasteries] = useState<Record<string, number>>({});

  const current = questions[index];

  const handleSubmit = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      const result = await gradeAnswer(current, answer);
      setFeedback(result);
      if (result.isCorrect) {
        setScore(prev => prev + 1);
        setMasteries(prev => ({
          ...prev,
          [current.conceptId]: (prev[current.conceptId] || 0) + 10
        }));
      } else {
        setMasteries(prev => ({
          ...prev,
          [current.conceptId]: Math.max(0, (prev[current.conceptId] || 0) - 5)
        }));
      }
    } catch (e) {
      alert("Grading failed. Moving to next question.");
      setFeedback({ isCorrect: false, message: "Could not grade answer.", memoryTip: "" });
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (index < questions.length - 1) {
      setIndex(prev => prev + 1);
      setAnswer('');
      setFeedback(null);
    } else {
      onComplete(score, masteries);
    }
  };

  if (!current) return null;

  return (
    <div className="max-w-4xl mx-auto py-24 px-6">
      <div className="flex justify-between items-center mb-16">
        <div className="space-y-1">
          <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.4em]">{isExam ? 'Exam Mode' : 'Practice Session'}</span>
          <h2 className="text-4xl font-black text-slate-900">Question {index + 1} of {questions.length}</h2>
        </div>
        <Button variant="ghost" onClick={onExit}><X className="w-6 h-6" /></Button>
      </div>

      <Card className="mb-12 border-none shadow-2xl p-16">
        <div className="mb-10 text-3xl font-bold leading-tight text-slate-800">
          <MathRenderer text={current.question} />
        </div>

        {current.type === 'multiple-choice' && current.options ? (
          <div className="grid grid-cols-1 gap-4">
            {current.options.map(opt => (
              <button
                key={opt}
                onClick={() => setAnswer(opt)}
                className={`w-full p-6 text-left rounded-[1.5rem] font-bold text-xl transition-all border-2 ${answer === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            className="w-full p-8 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none focus:border-indigo-600 font-bold text-xl transition-all h-48"
            placeholder="Type your answer here..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}

        {feedback ? (
          <div className={`mt-12 p-10 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-500 ${feedback.isCorrect ? 'bg-emerald-50 border-2 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-2 border-rose-100 text-rose-900'}`}>
            <div className="flex items-center gap-4 mb-6">
              {feedback.isCorrect ? <CheckCircle2 className="w-10 h-10 text-emerald-500" /> : <AlertCircle className="w-10 h-10 text-rose-500" />}
              <span className="text-2xl font-black">{feedback.isCorrect ? 'Correct Recall!' : 'Incorrect'}</span>
            </div>
            <p className="text-lg font-bold mb-6 opacity-90">{feedback.message}</p>
            {!feedback.isCorrect && feedback.correction && (
              <div className="mb-6 p-6 bg-white/50 rounded-2xl border border-rose-200">
                <p className="text-sm font-black uppercase text-rose-400 mb-2">Correction</p>
                <p className="font-bold text-lg"><MathRenderer text={feedback.correction} /></p>
              </div>
            )}
            <div className="p-6 bg-white/50 rounded-2xl border border-indigo-100">
              <p className="text-sm font-black uppercase text-indigo-400 mb-2">Memory Tip</p>
              <p className="font-bold text-lg italic">{feedback.memoryTip}</p>
            </div>
          </div>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={!answer.trim() || loading} 
            variant="primary" 
            className="mt-12 w-full py-6 text-xl rounded-[2rem]"
          >
            {loading ? <RefreshCcw className="w-6 h-6 animate-spin" /> : 'Check Answer'}
          </Button>
        )}
      </Card>

      {feedback && (
        <Button onClick={next} variant="indigo" className="w-full py-6 text-xl rounded-[2rem]">
          {index === questions.length - 1 ? 'Finish Session' : 'Next Question'} <ArrowRight className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
};

// --- Workspace Views ---

const ConceptsView: React.FC<{ 
  studyData: StudyData; 
  user: User; 
  expandedConcept: string | null; 
  setExpandedConcept: (id: string | null) => void;
  onNavigate: (id: string) => void;
}> = ({ studyData, user, expandedConcept, setExpandedConcept, onNavigate }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <div className="lg:col-span-2 space-y-8">
        <div className="flex items-center gap-4 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 text-indigo-700">
          <Target className="w-6 h-6 flex-shrink-0" />
          <p className="font-bold text-sm">Focus on high-likelihood concepts. Each quiz session increases mastery levels.</p>
        </div>

        {studyData.concepts.map(concept => {
          const isExpanded = expandedConcept === concept.id;
          const mastery = user.conceptMastery[concept.id] || 0;
          const mnemonic = studyData.mnemonics.find(m => m.conceptId === concept.id);
          
          return (
            <Card 
              key={concept.id} 
              id={`concept-${concept.id}`}
              onClick={() => setExpandedConcept(isExpanded ? null : concept.id)}
              className={`group transition-all duration-500 ${isExpanded ? 'ring-4 ring-indigo-500/10 border-indigo-200 scale-[1.01]' : 'hover:border-indigo-200 hover:-translate-y-1'}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <h3 className={`text-2xl font-black transition-colors ${isExpanded ? 'text-indigo-600' : 'text-slate-900'}`}>{concept.term}</h3>
                  <div className="w-56">
                    <MasteryProgress level={mastery} compact />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${concept.testLikelihood === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                    {concept.testLikelihood} Risk
                  </span>
                  {isExpanded ? <ChevronUp className="w-6 h-6 text-indigo-600" /> : <ChevronDown className="w-6 h-6 text-slate-300 group-hover:text-indigo-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-8 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="text-slate-600 leading-relaxed text-xl font-bold bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <MathRenderer text={concept.explanation} />
                  </div>

                  {concept.relatedConceptIds && concept.relatedConceptIds.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <LinkIcon className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Connect Knowledge</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {concept.relatedConceptIds.map(rid => {
                          const related = studyData.concepts.find(c => c.id === rid);
                          if (!related) return null;
                          return (
                            <button 
                              key={rid} 
                              onClick={(e) => { e.stopPropagation(); onNavigate(rid); }}
                              className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-105"
                            >
                              {related.term}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {mnemonic && (
                    <div className="p-10 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group/mnem">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full translate-x-12 -translate-y-12 transition-transform group-hover/mnem:scale-150 duration-700" />
                      <div className="flex items-center gap-3 text-indigo-400 mb-6">
                        <Sparkles className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Mnemonic Engine</span>
                      </div>
                      <p className="text-3xl font-black mb-6 leading-tight tracking-tight">{mnemonic.aid}</p>
                      <div className="flex items-start gap-5 text-slate-400 bg-white/5 p-6 rounded-3xl border border-white/10">
                        <Eye className="w-6 h-6 mt-1.5 flex-shrink-0 text-indigo-300" />
                        <p className="italic text-lg leading-relaxed font-bold">{mnemonic.visualHook}</p>
                      </div>
                    </div>
                  )}
                  
                  {mastery === 100 && (
                    <div className="flex items-center gap-4 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-emerald-700">
                      <Trophy className="w-8 h-8" />
                      <div>
                        <p className="font-black text-lg">Subject Mastered</p>
                        <p className="text-sm opacity-80">You have achieved 100% retention for this concept.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="space-y-10">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-12 rounded-[3.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-16 translate-x-16 transition-transform group-hover:scale-125 duration-1000" />
          <h2 className="text-4xl font-black mb-10 tracking-tighter">Roadmap</h2>
          <div className="space-y-8">
            {studyData.plan.schedule.map((day, i) => (
              <div key={i} className={`p-6 rounded-3xl border-2 transition-all duration-500 ${i === 0 ? 'bg-white text-indigo-900 border-white shadow-2xl scale-105' : 'border-white/10 opacity-70 hover:opacity-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${i === 0 ? 'text-indigo-400' : 'text-indigo-200'}`}>Day {day.day}</span>
                  {i === 0 && <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black shadow-lg animate-pulse">ACTIVE</span>}
                </div>
                <p className="font-black text-xl mb-4 leading-none">{day.focus}</p>
                <div className="space-y-2">
                  {day.tasks.slice(0, 3).map((t, ti) => (
                    <p key={ti} className={`text-xs font-black flex items-center gap-3 ${i === 0 ? 'text-slate-500' : 'text-indigo-100'}`}>
                      <CheckCircle2 className={`w-4 h-4 ${i === 0 ? 'text-emerald-500' : 'text-indigo-300'}`} /> {t}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Core App Logic ---

export default function App() {
  const [mode, setMode] = useState<AppMode>('landing');
  const [user, setUser] = useState<User | null>(DB.getCurrentUser());
  const [tab, setTab] = useState<DashboardTab>('concepts');
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isExam, setIsExam] = useState(false);

  const handleUpload = async (file: File) => {
    if (!user) { setMode('auth'); return; }
    setMode('processing');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await processStudyMaterial(base64, file.type, user.profile);
        setStudyData(data);
        setMode('dashboard');
      };
      reader.readAsDataURL(file);
    } catch (err) { 
      console.error(err); 
      setMode('landing');
      alert("Analysis failed. Please try a different document.");
    }
  };

  const startQuiz = async (exam: boolean = false) => {
    if (!studyData) return;
    setMode('processing');
    try {
      const qs = await generateQuizQuestions(studyData, user?.weakAreas || []);
      setQuestions(qs);
      setIsExam(exam);
      setMode(exam ? 'exam' : 'quiz');
    } catch (err) { 
      setMode('dashboard');
      alert("Question generation failed. Retrying...");
    }
  };

  const scrollToConcept = (id: string) => {
    setTab('concepts');
    setExpandedConcept(id);
    setTimeout(() => {
      const el = document.getElementById(`concept-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setMode('landing')}>
            <div className="w-11 h-11 bg-indigo-600 rounded-[1rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 group-hover:rotate-12 transition-all">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <span className="font-black text-3xl text-slate-900 tracking-tighter">Memorize<span className="text-indigo-600">Pro</span></span>
          </div>
          
          <nav className="hidden md:flex items-center gap-10 mr-auto ml-16">
            <button onClick={() => setMode('landing')} className={`text-sm font-black transition-all ${mode === 'landing' ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>Home</button>
            <button onClick={() => setMode('network')} className={`text-sm font-black transition-all ${mode === 'network' ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>Community</button>
            {studyData && <button onClick={() => setMode('dashboard')} className={`text-sm font-black transition-all ${mode === 'dashboard' ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>Active Sheet</button>}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-1.5 pl-5 rounded-full shadow-inner">
                <span className="text-xs font-black text-slate-900">{user.username}</span>
                <button onClick={() => setMode('profile')} className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 hover:text-indigo-600 shadow-sm transition-all"><UserIcon className="w-5 h-5" /></button>
                <button onClick={() => { DB.setCurrentUser(null); setUser(null); setMode('landing'); }} className="p-2 text-slate-400 hover:text-rose-500 transition-all"><LogOut className="w-5 h-5" /></button>
              </div>
            ) : (
              <Button onClick={() => setMode('auth')} variant="outline" className="text-xs">Sign In</Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {mode === 'auth' && <AuthMode onAuth={(u) => { setUser(u); setMode('landing'); }} />}
        {mode === 'profile' && user && <ProfileView user={user} onSave={(u) => { DB.saveUser(u); setUser(u); setMode('landing'); }} />}
        {mode === 'network' && user && <NetworkView user={user} onOpen={(d) => { setStudyData(d); setMode('dashboard'); }} />}
        
        {mode === 'landing' && (
          <div className="max-w-5xl mx-auto py-24 px-6 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black mb-14 uppercase tracking-[0.2em] shadow-sm animate-bounce">
              <Zap className="w-4 h-4" /> Cognitive Mastery Platform
            </div>
            <h1 className="text-8xl md:text-9xl font-black text-slate-900 mb-10 tracking-tighter leading-[0.85]">
              Mastery in <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">Record Time.</span>
            </h1>
            <p className="text-2xl text-slate-400 mb-20 max-w-3xl mx-auto font-medium leading-relaxed">
              Upload notes. Master diagrams. Automate recall. <br />Powered by advanced cognitive science and AI.
            </p>

            <div className="bg-white p-24 rounded-[5rem] border-4 border-dashed border-slate-100 hover:border-indigo-400 transition-all relative group cursor-pointer overflow-hidden shadow-2xl shadow-slate-200/50 mb-24">
              <input type="file" accept="application/pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files && handleUpload(e.target.files[0])} />
              <div className="flex flex-col items-center relative z-0">
                <div className="w-28 h-28 bg-indigo-50 rounded-[3rem] flex items-center justify-center text-indigo-600 mb-12 transform group-hover:scale-110 group-hover:rotate-6 transition-all shadow-inner"><Upload className="w-12 h-12" /></div>
                <span className="text-5xl font-black text-slate-900 tracking-tight">Drop study file</span>
                <span className="text-slate-400 mt-5 font-bold text-xl">PDFs or Screenshots • Intelligent Analysis</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { icon: <BookOpen className="text-indigo-600" />, title: 'Recall Hub', desc: 'Dynamic navigation between linked concepts and mastery tracking.' },
                { icon: <Sparkles className="text-emerald-500" />, title: 'Visual Blueprints', desc: 'Step-by-step mental hooks for every diagram and chart.' },
                { icon: <Variable className="text-indigo-400" />, title: 'KaTeX Ready', desc: 'Flawless math notation with plain-English verbal translations.' },
              ].map((feat, i) => (
                <div key={i} className="bg-white p-14 rounded-[4rem] border border-slate-50 text-left hover:-translate-y-4 transition-all shadow-xl shadow-slate-100/50">
                  <div className="mb-10 p-6 bg-slate-50 rounded-3xl w-fit">{feat.icon}</div>
                  <h4 className="font-black text-slate-900 mb-5 text-3xl tracking-tight">{feat.title}</h4>
                  <p className="text-slate-500 text-lg font-medium leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'processing' && (
          <div className="flex flex-col items-center justify-center py-64">
            <div className="relative w-48 h-48 mb-16">
              <div className="absolute inset-0 border-[16px] border-indigo-50 rounded-full" />
              <div className="absolute inset-0 border-[16px] border-indigo-600 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center"><BrainCircuit className="w-16 h-16 text-indigo-600 animate-pulse" /></div>
            </div>
            <h2 className="text-6xl font-black text-slate-900 mb-5 tracking-tight">Processing...</h2>
            <p className="text-slate-400 font-bold text-2xl">Constructing your cognitive map.</p>
          </div>
        )}

        {mode === 'dashboard' && studyData && user && (
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-24">
              <div className="flex-1">
                <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.5em] bg-indigo-50 px-6 py-2 rounded-full mb-8 inline-block shadow-sm">Workspace Active</span>
                <h1 className="text-7xl font-black text-slate-900 tracking-tighter mb-8 leading-none">{studyData.title}</h1>
                <div className="flex flex-wrap items-center gap-10">
                  <div className="flex items-center gap-3 text-lg font-black text-slate-400"><FileText className="w-6 h-6 text-indigo-500" /> {studyData.concepts.length} Concepts</div>
                  <div className="flex items-center gap-3 text-lg font-black text-slate-400"><Variable className="w-6 h-6 text-emerald-500" /> {studyData.equations?.length || 0} Formulas</div>
                  <div className="flex items-center gap-3 text-lg font-black text-slate-400"><Target className="w-6 h-6 text-amber-500" /> Mastery Enabled</div>
                </div>
              </div>
              <div className="flex gap-5">
                <Button onClick={() => startQuiz(false)} variant="secondary" className="px-10 py-5 text-xl"><PlayCircle className="w-6 h-6" /> Start Quiz</Button>
                <Button onClick={() => startQuiz(true)} variant="danger" className="px-10 py-5 text-xl shadow-rose-200"><Timer className="w-6 h-6" /> Exam Mode</Button>
              </div>
            </div>

            <div className="flex border-b-2 border-slate-100 mb-20 overflow-x-auto no-scrollbar gap-6">
              {[
                { id: 'concepts', label: 'Recall Hub', icon: <BookOpen className="w-6 h-6" /> },
                { id: 'flashcards', label: 'Flashcards', icon: <Layers className="w-6 h-6" /> },
                { id: 'formulas', label: 'Formulas', icon: <Variable className="w-6 h-6" /> },
                { id: 'visuals', label: 'Diagrams', icon: <ImageIcon className="w-6 h-6" /> },
                { id: 'tutor', label: 'AI Tutor', icon: <MessageSquare className="w-6 h-6" /> },
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setTab(t.id as DashboardTab)} 
                  className={`px-12 py-8 flex items-center gap-5 font-black text-lg transition-all border-b-[8px] whitespace-nowrap ${tab === t.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
              {tab === 'concepts' && (
                <ConceptsView 
                  studyData={studyData} 
                  user={user} 
                  expandedConcept={expandedConcept} 
                  setExpandedConcept={setExpandedConcept}
                  onNavigate={scrollToConcept}
                />
              )}

              {tab === 'flashcards' && <Flashcards concepts={studyData.concepts} mnemonics={studyData.mnemonics} />}
              
              {tab === 'formulas' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-10 max-w-6xl mx-auto">
                  {studyData.equations?.length ? studyData.equations.map(eq => (
                    <Card key={eq.id} className="p-0 border-none bg-slate-50/50 overflow-hidden group shadow-none hover:shadow-2xl transition-all duration-700">
                      <div className="p-10 pb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-3 block">{eq.term}</span>
                        <h4 className="text-3xl font-black text-slate-900 mb-8">{eq.plainEnglish}</h4>
                      </div>
                      
                      <div className="bg-[#1a1c23] p-20 flex flex-col items-center justify-center text-center relative text-white">
                        <div className="absolute top-6 left-6 text-slate-600 font-mono text-[10px] uppercase opacity-50 tracking-[0.3em]">LaTeX Output</div>
                        <div className="transform transition-transform group-hover:scale-110 duration-700 scale-125">
                          <MathRenderer text={eq.formula} />
                        </div>
                      </div>

                      <div className="p-10 bg-white border-t border-slate-100">
                        <p className="text-slate-600 leading-relaxed font-bold text-xl">{eq.explanation}</p>
                      </div>
                    </Card>
                  )) : <div className="col-span-2 text-center py-40 text-slate-300 font-black text-2xl border-4 border-dashed rounded-[4rem]">No formulas detected.</div>}
                </div>
              )}

              {tab === 'visuals' && (
                <div className="py-10 space-y-12 max-w-4xl mx-auto">
                  {studyData.visualAids?.map((aid) => (
                    <Card key={aid.id} className="border-l-[10px] border-l-emerald-500 bg-emerald-50/10 overflow-hidden p-12">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-4 bg-emerald-100 rounded-2xl text-emerald-600 shadow-sm"><ImageIcon className="w-8 h-8" /></div>
                        <h4 className="font-black text-slate-900 text-3xl tracking-tight">{aid.description}</h4>
                      </div>
                      <p className="text-slate-600 font-bold text-xl leading-relaxed mb-10">{aid.summary}</p>
                      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-100 shadow-lg relative">
                        <div className="flex items-start gap-5">
                          <Eye className="w-8 h-8 text-indigo-500 mt-1 flex-shrink-0" />
                          <p className="text-slate-900 leading-relaxed font-black text-2xl italic tracking-tight">"{aid.mentalImage}"</p>
                        </div>
                      </div>
                    </Card>
                  )) || <div className="text-center py-40 text-slate-300 font-black text-2xl border-4 border-dashed rounded-[4rem]">No visual aids available.</div>}
                </div>
              )}
              {tab === 'tutor' && <TutorChat concepts={studyData.concepts} />}
            </div>
          </div>
        )}

        {(mode === 'quiz' || mode === 'exam') && user && studyData && (
          <QuizView 
            questions={questions} 
            isExam={mode === 'exam'} 
            onComplete={(s, masteries) => {
              const updatedUser = { ...user! };
              updatedUser.quizHistory.push({ date: new Date().toISOString(), score: s, total: questions.length, sheetId: studyData!.id });
              
              Object.entries(masteries).forEach(([cid, increase]) => {
                updatedUser.conceptMastery[cid] = Math.min(100, (updatedUser.conceptMastery[cid] || 0) + (increase as number));
              });

              DB.saveUser(updatedUser);
              setUser(updatedUser);
              setMode('dashboard');
              alert(`Session Mastered! Score: ${s}/${questions.length}`);
            }}
            onExit={() => setMode('dashboard')}
          />
        )}
      </main>

      <footer className="mt-auto py-24 bg-slate-900 border-t border-slate-800 text-center text-white">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-black text-4xl mb-4 tracking-tighter">Muhammad Mahran</p>
          <p className="text-slate-500 text-xl font-bold mb-16 tracking-tight">Modern Academy for Engineering and Technology, TH5</p>
          <div className="flex flex-wrap items-center justify-center gap-16 text-slate-600 text-[10px] uppercase font-black tracking-[0.6em]">
            <span className="hover:text-indigo-400 transition-all cursor-pointer">Active Recall</span>
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
            <span className="hover:text-indigo-400 transition-all cursor-pointer">Mastery Loops</span>
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
            <span className="hover:text-indigo-400 transition-all cursor-pointer">KaTeX Render</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Auth & Utility Components ---

const AuthMode: React.FC<{ onAuth: (user: User) => void }> = ({ onAuth }) => {
  const [username, setUsername] = useState('');
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    const users = DB.getUsers();
    let user = users.find(u => u.username === username);
    if (!user) {
      user = {
        id: Math.random().toString(36).substr(2, 9),
        username,
        profile: { subject: 'General', academicLevel: 'Undergraduate', learningStyle: 'mixed', mnemonicPref: 'acronyms' },
        weakAreas: [], quizHistory: [], library: [], conceptMastery: {}
      };
      DB.saveUser(user);
    }
    DB.setCurrentUser(user);
    onAuth(user);
  };
  return (
    <div className="max-w-md mx-auto py-40 px-6">
      <Card className="p-14 border-none shadow-2xl">
        <h2 className="text-4xl font-black mb-10 text-center text-slate-900 tracking-tighter">Identity</h2>
        <form onSubmit={handleAuth} className="space-y-8">
          <input 
            className="w-full px-8 py-5 rounded-[2rem] border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all font-black text-2xl text-center"
            placeholder="Your name" value={username} onChange={e => setUsername(e.target.value)} autoFocus
          />
          <Button type="submit" variant="primary" className="w-full py-6 text-xl rounded-[2rem]">Enter Engine <ArrowRight className="w-6 h-6" /></Button>
        </form>
      </Card>
    </div>
  );
};

const ProfileView: React.FC<{ user: User; onSave: (user: User) => void }> = ({ user, onSave }) => {
  const [profile, setProfile] = useState(user.profile);
  return (
    <div className="max-w-3xl mx-auto py-24 px-6">
      <h1 className="text-6xl font-black mb-16 tracking-tighter">Profile Engine</h1>
      <Card className="space-y-14 p-16 border-none shadow-2xl">
        <div className="grid grid-cols-2 gap-10">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-4 tracking-[0.3em]">Academic Level</label>
            <select value={profile.academicLevel} onChange={e => setProfile({...profile, academicLevel: e.target.value})} className="w-full p-5 rounded-3xl border-2 border-slate-50 bg-slate-50 font-black text-lg outline-none focus:border-indigo-600 transition-all">
              <option>Undergraduate</option><option>High School</option><option>Postgraduate</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-4 tracking-[0.3em]">Core Subject</label>
            <input value={profile.subject} onChange={e => setProfile({...profile, subject: e.target.value})} className="w-full p-5 rounded-3xl border-2 border-slate-50 bg-slate-50 font-black text-lg outline-none focus:border-indigo-600 transition-all" />
          </div>
        </div>
        <Button onClick={() => onSave({ ...user, profile })} variant="primary" className="w-full py-6 text-xl rounded-[2.5rem]">Update Profile</Button>
      </Card>
    </div>
  );
};

const NetworkView: React.FC<{ user: User; onOpen: (data: StudyData) => void }> = ({ user, onOpen }) => {
  const network = DB.getNetwork();
  const [search, setSearch] = useState('');
  const filtered = network.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="max-w-7xl mx-auto px-6 py-24">
      <div className="flex justify-between items-center mb-20">
        <h1 className="text-7xl font-black tracking-tighter">Library</h1>
        <div className="relative w-96">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          <input className="w-full pl-16 pr-8 py-5 rounded-full bg-slate-100 outline-none font-bold text-xl" placeholder="Search guides..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {filtered.map(sheet => (
          <Card key={sheet.id} className="cursor-pointer group p-14 rounded-[4rem] border-none shadow-xl hover:-translate-y-4 transition-all" onClick={() => onOpen(sheet.data)}>
            <h3 className="text-4xl font-black mb-6 group-hover:text-indigo-600 transition-colors tracking-tighter leading-none">{sheet.title}</h3>
            <p className="text-slate-400 text-lg font-bold mb-12">{sheet.subject} • {sheet.level}</p>
            <Button variant="ghost" className="text-sm font-black p-0 hover:bg-transparent hover:text-indigo-600">View Blueprint <ArrowRight className="w-5 h-5 ml-2" /></Button>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-40 text-slate-300 font-black text-3xl border-4 border-dashed rounded-[4rem]">No public sheets found.</div>}
      </div>
    </div>
  );
};

const TutorChat: React.FC<{ concepts: Concept[] }> = ({ concepts }) => {
  const [selectedConceptId, setSelectedConceptId] = useState(concepts[0]?.id);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleAsk = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const selectedConcept = concepts.find(c => c.id === selectedConceptId);
    if (!selectedConcept) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const aiResponse = await askTutoring(selectedConcept.term, selectedConcept.explanation, userMsg);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (err) { setMessages(prev => [...prev, { role: 'ai', text: "Service temporarily offline. Check connection." }]); }
    finally { setLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-12 py-10 h-[850px] max-w-7xl mx-auto">
      <div className="bg-slate-50/50 rounded-[4rem] p-10 border border-slate-100 overflow-y-auto shadow-inner">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-10 ml-4">Topic Context</h4>
        <div className="space-y-4">
          {concepts.map(c => (
            <button key={c.id} onClick={() => setSelectedConceptId(c.id)} className={`w-full text-left p-5 rounded-[2rem] text-lg font-black transition-all ${selectedConceptId === c.id ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'hover:bg-white text-slate-600 shadow-sm'}`}>{c.term}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col bg-white rounded-[4.5rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="flex-1 overflow-y-auto p-12 space-y-10">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-8 rounded-[2.5rem] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-900 font-bold text-xl rounded-tl-none shadow-sm'}`}>
                <MathRenderer text={m.text} />
              </div>
            </div>
          ))}
          {loading && <div className="text-slate-300 animate-pulse font-black p-8 text-2xl tracking-tight">Tutor generating insight...</div>}
          <div ref={scrollRef} />
        </div>
        <form onSubmit={handleAsk} className="p-12 bg-slate-50 flex gap-8">
          <input className="flex-1 bg-white border-2 border-slate-100 outline-none px-10 py-6 rounded-[2.5rem] text-xl font-bold shadow-sm focus:border-indigo-600 transition-all" placeholder="Ask for an analogy..." value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" variant="primary" className="p-8 rounded-full shadow-2xl" disabled={loading}><Send className="w-8 h-8" /></Button>
        </form>
      </div>
    </div>
  );
}
