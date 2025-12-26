
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  BrainCircuit, 
  Calendar, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  Lightbulb, 
  PlayCircle, 
  RefreshCcw, 
  Timer, 
  Upload, 
  X,
  AlertCircle,
  Layout,
  Layers,
  Network,
  MessageSquare,
  User as UserIcon,
  LogIn,
  ArrowRight,
  Send,
  Zap,
  Variable,
  Scale,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import { StudyData, AppMode, QuizQuestion, QuizFeedback, User, DashboardTab, Concept } from './types';
import { processStudyMaterial, generateQuizQuestions, gradeAnswer, askTutoring } from './geminiService';

// --- Simple Local Storage Database ---
const DB = {
  getUsers: (): User[] => JSON.parse(localStorage.getItem('mp_users') || '[]'),
  saveUser: (user: User) => {
    const users = DB.getUsers();
    const index = users.findIndex(u => u.username === user.username);
    if (index > -1) users[index] = user;
    else users.push(user);
    localStorage.setItem('mp_users', JSON.stringify(users));
  },
  getCurrentUser: (): User | null => JSON.parse(localStorage.getItem('mp_current_user') || 'null'),
  setCurrentUser: (user: User | null) => localStorage.setItem('mp_current_user', JSON.stringify(user))
};

// --- Shared Components ---

const Button: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}> = ({ onClick, children, variant = 'primary', className = '', disabled, type = "button" }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

// --- Sub-Components ---

const AuthMode: React.FC<{ onAuth: (user: User) => void }> = ({ onAuth }) => {
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    const users = DB.getUsers();
    let user = users.find(u => u.username === username);
    if (!user) {
      user = { id: Math.random().toString(36).substr(2, 9), username, weakAreas: [], quizHistory: [] };
      DB.saveUser(user);
    }
    DB.setCurrentUser(user);
    onAuth(user);
  };

  return (
    <div className="max-w-md mx-auto py-20 px-4">
      <Card className="p-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <UserIcon className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">{isLogin ? 'Sign In' : 'Create Account'}</h2>
        <p className="text-slate-500 text-center mb-8">Save your progress and track weak areas.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              autoFocus
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full py-3">
            {isLogin ? 'Sign In' : 'Sign Up'} <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
};

const Flashcards: React.FC<{ concepts: Concept[] }> = ({ concepts }) => {
  const [idx, setIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const concept = concepts[idx];

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      <div 
        className="relative w-full max-w-lg aspect-[3/2] cursor-pointer perspective-1000 group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          {/* Front */}
          <div className="absolute inset-0 bg-white border-2 border-slate-100 rounded-3xl shadow-xl flex flex-col items-center justify-center p-12 backface-hidden">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Term</span>
            <h3 className="text-3xl font-black text-slate-900 text-center">{concept.term}</h3>
            <div className="mt-12 text-slate-400 flex items-center gap-2 text-sm">
              <RefreshCcw className="w-4 h-4" /> Click to flip
            </div>
          </div>
          {/* Back */}
          <div className="absolute inset-0 bg-indigo-600 text-white rounded-3xl shadow-xl flex flex-col items-center justify-center p-12 rotate-y-180 backface-hidden overflow-y-auto">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-4">Explanation</span>
            <p className="text-xl text-center leading-relaxed font-medium">{concept.explanation}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Button variant="outline" onClick={() => { setIdx(Math.max(0, idx - 1)); setIsFlipped(false); }} disabled={idx === 0}>
          Previous
        </Button>
        <span className="text-slate-500 font-medium">{idx + 1} / {concepts.length}</span>
        <Button variant="primary" onClick={() => { setIdx(Math.min(concepts.length - 1, idx + 1)); setIsFlipped(false); }} disabled={idx === concepts.length - 1}>
          Next
        </Button>
      </div>
    </div>
  );
};

const Visualizer: React.FC<{ flowchart?: StudyData['flowchart'], visualAids?: StudyData['visualAids'] }> = ({ flowchart, visualAids }) => {
  if ((!flowchart || flowchart.length === 0) && (!visualAids || visualAids.length === 0)) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Network className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No processes or visual diagrams identified in this material.</p>
      </div>
    );
  }

  return (
    <div className="py-10 space-y-12">
      {flowchart && flowchart.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-8">
            <Network className="w-5 h-5 text-indigo-600" /> Process Flow
          </h3>
          <div className="flex flex-col items-center gap-6">
            {flowchart.map((node, i) => (
              <React.Fragment key={node.id}>
                <Card className="w-full max-w-xl border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
                  <h4 className="font-bold text-slate-900 mb-1">{node.label}</h4>
                  <p className="text-sm text-slate-600">{node.description}</p>
                </Card>
                {i < flowchart.length - 1 && (
                  <div className="w-1 h-8 bg-slate-200 rounded-full"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {visualAids && visualAids.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-8">
            <ImageIcon className="w-5 h-5 text-emerald-600" /> Diagram & Image Analysis
          </h3>
          <div className="grid grid-cols-1 gap-8">
            {visualAids.map((aid) => (
              <Card key={aid.id} className="bg-emerald-50/20 border-emerald-100 flex flex-col md:flex-row gap-6">
                <div className="md:w-1/3">
                  <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600 mb-4 flex items-center gap-2 w-fit">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Source Analysis</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">{aid.description}</h4>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{aid.summary}</p>
                </div>
                <div className="md:w-2/3 bg-white/60 p-6 rounded-xl border border-emerald-100/50">
                  <div className="flex items-center gap-2 mb-3 text-indigo-600">
                    <Eye className="w-4 h-4" />
                    <h5 className="text-xs font-black uppercase tracking-widest">Visual Mnemonic (Imagine This)</h5>
                  </div>
                  <p className="text-slate-800 leading-relaxed text-sm font-medium whitespace-pre-wrap">
                    {aid.mentalImage}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const FormulasLaws: React.FC<{ equations?: StudyData['equations'], laws?: StudyData['laws'] }> = ({ equations, laws }) => {
  if ((!equations || equations.length === 0) && (!laws || laws.length === 0)) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Variable className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No equations or laws found in this material.</p>
      </div>
    );
  }

  return (
    <div className="py-10 space-y-12">
      {equations && equations.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Variable className="w-5 h-5 text-indigo-600" /> Equations & Formulas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {equations.map((eq) => (
              <Card key={eq.id} className="border-t-4 border-t-indigo-500">
                <h4 className="font-bold text-slate-500 text-xs uppercase mb-2 tracking-widest">{eq.term}</h4>
                <div className="bg-slate-900 text-indigo-300 p-4 rounded-lg font-mono text-center text-lg mb-4 shadow-inner">
                  {eq.formula}
                </div>
                <p className="text-sm text-slate-600">{eq.explanation}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {laws && laws.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Scale className="w-5 h-5 text-rose-600" /> Scientific Laws & Principles
          </h3>
          <div className="space-y-4">
            {laws.map((law) => (
              <Card key={law.id} className="bg-rose-50/30 border-rose-100">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-bold text-rose-900">{law.name}</h4>
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-tighter bg-white px-2 py-0.5 rounded border border-rose-100">Official Law</span>
                </div>
                <p className="text-slate-800 font-medium italic mb-3">"{law.statement}"</p>
                <div className="bg-white/60 p-3 rounded-lg border border-rose-50">
                  <p className="text-xs font-bold text-rose-700 uppercase mb-1">Practical Application</p>
                  <p className="text-sm text-slate-600">{law.application}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const TutorChat: React.FC<{ concepts: Concept[] }> = ({ concepts }) => {
  const [selectedConceptId, setSelectedConceptId] = useState(concepts[0]?.id);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Error: Could not reach tutor." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 py-6 h-[600px]">
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 overflow-y-auto">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Select Topic</h4>
        <div className="space-y-2">
          {concepts.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedConceptId(c.id)}
              className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                selectedConceptId === c.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'
              }`}
            >
              {c.term}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p>Ask a clarifying question about the selected topic.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl ${
                m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none animate-pulse text-slate-400">
                Tutor is typing...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
        <form onSubmit={handleAsk} className="p-4 border-t border-slate-100 flex gap-2">
          <input
            className="flex-1 bg-slate-50 border-none outline-none p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
            placeholder="How does this work in real life?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" variant="primary" className="p-2" disabled={loading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [mode, setMode] = useState<AppMode>('landing');
  const [user, setUser] = useState<User | null>(DB.getCurrentUser());
  const [tab, setTab] = useState<DashboardTab>('concepts');
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isExam, setIsExam] = useState(false);
  const [finalScore, setFinalScore] = useState<{ score: number, total: number } | null>(null);

  useEffect(() => {
    // If user is already logged in, we could potentially load their last session
  }, []);

  const handleUpload = async (file: File) => {
    if (!user) {
      setMode('auth');
      return;
    }
    setMode('processing');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await processStudyMaterial(base64, file.type);
        setStudyData(data);
        setMode('dashboard');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setMode('landing');
    }
  };

  const startQuiz = async (exam: boolean = false) => {
    if (!studyData) return;
    setMode('processing');
    try {
      // Pass weak areas to bias questions
      const qs = await generateQuizQuestions(studyData, user?.weakAreas || []);
      setQuestions(qs);
      setIsExam(exam);
      setMode(exam ? 'exam' : 'quiz');
    } catch (err) {
      console.error(err);
      setMode('dashboard');
    }
  };

  const finishQuiz = (score: number) => {
    if (user) {
      // Update weak areas based on missed questions
      const updatedUser = { ...user };
      updatedUser.quizHistory.push({ date: new Date().toISOString(), score, total: questions.length });
      
      DB.saveUser(updatedUser);
      setUser(updatedUser);
      DB.setCurrentUser(updatedUser);
    }
    setFinalScore({ score, total: questions.length });
    setMode('dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMode('landing')}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-900">Memorize<span className="text-indigo-600">Pro</span></span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Also by Muhammad Mahran</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-slate-900 leading-none">{user.username}</p>
                  <p className="text-[10px] text-slate-400">Lvl 1 Memory Master</p>
                </div>
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                  <UserIcon className="w-4 h-4" />
                </div>
                <Button onClick={() => { DB.setCurrentUser(null); setUser(null); setMode('landing'); }} variant="ghost" className="p-1">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => setMode('auth')} variant="outline" className="text-xs">
                <LogIn className="w-3 h-3" /> Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {mode === 'auth' && <AuthMode onAuth={(u) => { setUser(u); setMode('landing'); }} />}
        
        {mode === 'landing' && (
          <div className="max-w-4xl mx-auto py-12 px-4 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-3xl mb-8">
              <Zap className="w-10 h-10 text-indigo-600 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
              Rapid Memorization <span className="text-indigo-600">Powerup</span>
            </h1>
            <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
              Active Recall + Flashcards + AI Tutoring + Visual Mnemonics. Upload any material to master it in 3 days.
            </p>

            <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all relative group cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/20 transition-colors"></div>
              <input
                type="file"
                accept="application/pdf,image/*"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
              />
              <div className="flex flex-col items-center relative z-0">
                <Upload className="w-12 h-12 text-indigo-600 mb-4 transform group-hover:-translate-y-1 transition-transform" />
                <span className="text-lg font-medium text-slate-700">Select Study PDF or Image</span>
                <span className="text-sm text-slate-400 mt-1">We'll identify concepts, mnemonics, equations, and visual step-by-step imagery.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
              {[
                { icon: <BookOpen />, title: 'Recall Hub', color: 'text-blue-500' },
                { icon: <Variable />, title: 'Equations', color: 'text-purple-500' },
                { icon: <Layers />, title: 'Flashcards', color: 'text-emerald-500' },
                { icon: <Eye />, title: 'Visual Hooks', color: 'text-amber-500' },
              ].map((feat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                  <div className={`mb-3 ${feat.color}`}>{feat.icon}</div>
                  <h4 className="font-bold text-slate-800 text-sm">{feat.title}</h4>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {mode === 'processing' && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Building Your Memory Engine...</h2>
            <p className="text-slate-500">Creating vivid mental hooks and analyzing diagrams.</p>
          </div>
        )}

        {mode === 'dashboard' && studyData && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h1 className="text-3xl font-black text-slate-900 mb-2">Learning Dashboard</h1>
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-2 text-sm text-slate-500">
                     <FileText className="w-4 h-4" /> {studyData.concepts.length} Concepts
                   </div>
                   <div className="flex items-center gap-2 text-sm text-slate-500">
                     <Variable className="w-4 h-4" /> {studyData.equations?.length || 0} Equations
                   </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => startQuiz(false)} variant="secondary">
                  <PlayCircle className="w-4 h-4" /> Practice Quiz
                </Button>
                <Button onClick={() => startQuiz(true)} variant="danger">
                  <Timer className="w-4 h-4" /> Exam Mode
                </Button>
              </div>
            </div>

            {/* Dashboard Tabs */}
            <div className="flex border-b border-slate-100 mb-8 overflow-x-auto no-scrollbar">
              {[
                { id: 'concepts', label: 'Recall Hub', icon: <BookOpen className="w-4 h-4" /> },
                { id: 'flashcards', label: 'Flashcards', icon: <Layers className="w-4 h-4" /> },
                { id: 'formulas', label: 'Formulas & Laws', icon: <Variable className="w-4 h-4" /> },
                { id: 'visuals', label: 'Diagram Tools', icon: <ImageIcon className="w-4 h-4" /> },
                { id: 'tutor', label: 'AI Tutor', icon: <MessageSquare className="w-4 h-4" /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as DashboardTab)}
                  className={`px-6 py-4 flex items-center gap-2 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
                    tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {tab === 'concepts' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {studyData.concepts.map(concept => {
                    const mnemonic = studyData.mnemonics.find(m => m.conceptId === concept.id);
                    return (
                      <Card key={concept.id} className="group relative">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xl font-bold text-slate-900">{concept.term}</h3>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            concept.testLikelihood === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {concept.testLikelihood} Risk
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed mb-6">{concept.explanation}</p>
                        
                        {mnemonic && (
                          <div className="mb-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                              <Lightbulb className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Memory Hook</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 mb-1">Mnemonic: <span className="text-indigo-600 font-mono">{mnemonic.aid}</span></p>
                            <div className="mt-2 flex items-start gap-2">
                              <Eye className="w-3 h-3 text-slate-400 mt-1 flex-shrink-0" />
                              <p className="text-xs text-slate-500 italic">Imagine: {mnemonic.visualHook}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 border-t border-slate-50 pt-4">
                          <Button variant="ghost" className="text-xs py-1" onClick={() => { setTab('tutor'); }}>
                            Clarify Concept
                          </Button>
                          <Button variant="ghost" className="text-xs py-1" onClick={() => { setTab('flashcards'); }}>
                            Quiz Term
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-xl font-bold text-slate-800">3-Day Repetition</h2>
                  </div>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden text-white">
                    <div className="p-6 bg-indigo-600">
                      <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Active Schedule</p>
                      <h3 className="text-lg font-black">Spaced Mastery</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {studyData.plan.schedule.map((day, i) => (
                        <div key={i} className={`p-4 rounded-xl border border-slate-800 ${i === 0 ? 'bg-slate-800 shadow-lg ring-1 ring-slate-700' : ''}`}>
                          <p className="text-xs font-bold text-slate-500 mb-1">Day {day.day}</p>
                          <p className="font-bold text-sm mb-2">{day.focus}</p>
                          <ul className="space-y-1">
                            {day.tasks.slice(0, 3).map((t, ti) => (
                              <li key={ti} className="text-xs text-slate-400 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'flashcards' && <Flashcards concepts={studyData.concepts} />}
            {tab === 'formulas' && <FormulasLaws equations={studyData.equations} laws={studyData.laws} />}
            {tab === 'visuals' && <Visualizer flowchart={studyData.flowchart} visualAids={studyData.visualAids} />}
            {tab === 'tutor' && <TutorChat concepts={studyData.concepts} />}
          </div>
        )}

        {(mode === 'quiz' || mode === 'exam') && (
          <QuizView 
            questions={questions} 
            isExam={mode === 'exam'} 
            onComplete={finishQuiz}
            onExit={() => setMode('dashboard')}
          />
        )}
      </main>

      <footer className="mt-auto py-10 bg-slate-900 border-t border-slate-800 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-white font-black text-xl mb-1 tracking-tight">Muhammad Mahran</p>
          <p className="text-slate-400 text-sm font-medium mb-4">Modern Academy for Engineering and Technology, TH5</p>
          <div className="flex items-center justify-center gap-4 text-slate-500 text-xs uppercase font-bold tracking-[0.2em]">
            <span>Active Recall</span>
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            <span>Spaced Repetition</span>
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            <span>Memory Hooks</span>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}

const QuizView: React.FC<{ 
  questions: QuizQuestion[]; 
  isExam?: boolean; 
  onComplete: (score: number) => void;
  onExit: () => void;
}> = ({ questions, isExam, onComplete, onExit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(isExam ? questions.length * 45 : 0);

  const currentQ = questions[currentIdx];

  useEffect(() => {
    if (isExam && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => {
        if (prev <= 1) {
          onComplete(score);
          return 0;
        }
        return prev - 1;
      }), 1000);
      return () => clearInterval(timer);
    }
  }, [isExam, timeLeft, score, onComplete]);

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    setLoadingFeedback(true);
    try {
      const res = await gradeAnswer(currentQ, userAnswer);
      setFeedback(res);
      if (res.isCorrect) setScore(prev => prev + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setUserAnswer('');
      setFeedback(null);
    } else {
      onComplete(score);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-6 h-6 text-slate-400" />
          </button>
          <span className="text-slate-500 font-medium">Question {currentIdx + 1} of {questions.length}</span>
        </div>
        {isExam && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold ${timeLeft < 30 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
            <Timer className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="h-2 bg-slate-100 rounded-full w-full">
          <div 
            className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-8 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-8 leading-tight">
          {currentQ.question}
        </h2>

        {currentQ.type === 'multiple-choice' ? (
          <div className="space-y-3">
            {currentQ.options?.map((opt, i) => (
              <button
                key={i}
                disabled={feedback !== null}
                onClick={() => setUserAnswer(opt)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  userAnswer === opt 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 hover:border-slate-300 text-slate-600'
                } ${feedback && opt === currentQ.correctAnswer ? 'border-emerald-500 bg-emerald-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span>{opt}</span>
                  {feedback && opt === currentQ.correctAnswer && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              disabled={feedback !== null}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-4 h-32 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none resize-none transition-all"
            />
          </div>
        )}
      </Card>

      {feedback && (
        <div className={`p-6 rounded-xl border-2 mb-6 ${feedback.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <div className="flex items-start gap-3">
            {feedback.isCorrect ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-rose-600" />}
            <div className="flex-1">
              <h4 className="font-bold mb-1">{feedback.isCorrect ? 'Great Job!' : 'Keep Learning'}</h4>
              <p className="text-sm mb-3">{feedback.message}</p>
              {!feedback.isCorrect && (
                <p className="text-sm font-bold text-rose-700 mb-3">Target answer: {currentQ.correctAnswer}</p>
              )}
              {feedback.memoryTip && (
                <div className="bg-white/50 p-3 rounded-lg flex gap-2 items-center">
                   <Lightbulb className="w-4 h-4 text-amber-500" />
                   <p className="text-xs italic text-slate-600">{feedback.memoryTip}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {!feedback ? (
          <Button onClick={handleSubmit} disabled={!userAnswer.trim() || loadingFeedback}>
            {loadingFeedback ? 'Grading...' : 'Submit Answer'}
          </Button>
        ) : (
          <Button onClick={handleNext} variant="primary">
            {currentIdx < questions.length - 1 ? 'Next Question' : 'View Results'} <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
