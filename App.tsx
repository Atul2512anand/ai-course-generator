import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GeminiService } from './services/geminiService';
import { YouTubeService } from './services/youtubeService';
import { Course, CourseLevel, AppSettings, SavedCourseStub, QuizQuestion } from './types';
import { BookOpen, Settings as SettingsIcon, PlayCircle, Award, ChevronDown, Trash2, Download, Save, Moon, Sun } from './components/Icons';
import { Certificate } from './components/Certificate';

// --- Internal Quiz Component ---
const ModuleQuiz = ({ questions }: { questions: QuizQuestion[] }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState<Record<number, boolean>>({});

  const handleOptionSelect = (qIdx: number, optIdx: number) => {
    if (showResult[qIdx]) return; // Prevent changing after revealing
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
    setShowResult(prev => ({ ...prev, [qIdx]: true }));
  };

  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
      <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
        <span className="bg-green-100 text-green-700 p-1 rounded">?</span> Knowledge Check
      </h4>
      <div className="space-y-6">
        {questions.map((q, qIdx) => {
          const isAnswered = showResult[qIdx];
          const isCorrect = answers[qIdx] === q.correctAnswer;
          
          return (
            <div key={qIdx} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
              <p className="font-medium mb-3 text-gray-900 dark:text-gray-100">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, optIdx) => {
                  let btnClass = "w-full text-left px-4 py-2 rounded border transition-colors ";
                  if (isAnswered) {
                    if (optIdx === q.correctAnswer) {
                      btnClass += "bg-green-100 border-green-500 text-green-900 dark:bg-green-900/40 dark:text-green-100";
                    } else if (answers[qIdx] === optIdx) {
                      btnClass += "bg-red-100 border-red-500 text-red-900 dark:bg-red-900/40 dark:text-red-100";
                    } else {
                      btnClass += "border-gray-200 dark:border-gray-600 opacity-50";
                    }
                  } else {
                    btnClass += "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700";
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleOptionSelect(qIdx, optIdx)}
                      disabled={isAnswered}
                      className={btnClass}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {isAnswered && (
                <div className={`mt-3 text-sm p-2 rounded ${isCorrect ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20' : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20'}`}>
                  <strong>{isCorrect ? "Correct!" : "Incorrect."}</strong> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function App() {
  // --- State ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [settings, setSettings] = useState<AppSettings>({
    geminiKey: '',
    youtubeKey: '',
    userName: '',
    university: ''
  });
  
  // Generation Inputs
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<CourseLevel>(CourseLevel.Beginner);
  const [duration, setDuration] = useState(5);
  
  // Application Data
  const [course, setCourse] = useState<Course | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourseStub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Accordion State
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
  const [selectedLesson, setSelectedLesson] = useState<{moduleIdx: number, lessonIdx: number} | null>(null);
  const [videoIds, setVideoIds] = useState<Record<string, string>>({});

  const certificateRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Load Persistence
  useEffect(() => {
    const storedSettings = localStorage.getItem('acg_settings');
    if (storedSettings) setSettings(JSON.parse(storedSettings));

    const storedCourses = localStorage.getItem('acg_history');
    if (storedCourses) setSavedCourses(JSON.parse(storedCourses));

    const storedTheme = localStorage.getItem('acg_theme') as 'light' | 'dark';
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);

  // Save Persistence
  useEffect(() => {
    localStorage.setItem('acg_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('acg_history', JSON.stringify(savedCourses));
  }, [savedCourses]);

  useEffect(() => {
    localStorage.setItem('acg_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);


  // --- Logic ---

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.geminiKey) {
      setError("Please enter your Gemini API Key in settings.");
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError('');
    setCourse(null);
    setSelectedLesson(null);
    setExpandedModules({});
    setVideoIds({});

    try {
      const gemini = new GeminiService(settings.geminiKey);
      const generatedData = await gemini.generateCourse(topic, level, duration);
      
      const newCourse: Course = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        topic,
        level,
        duration: `${duration} hours`,
        ...generatedData
      };

      setCourse(newCourse);
      // Auto-save to history
      saveCourseToHistory(newCourse);
    } catch (err: any) {
      setError(err.message || "Failed to generate course. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveCourseToHistory = (c: Course) => {
    const stub: SavedCourseStub = { id: c.id, title: c.title, createdAt: c.createdAt };
    // Check if already exists (by ID) to avoid duplicates if re-saving
    const exists = savedCourses.some(s => s.id === c.id);
    if (!exists) {
        const updated = [stub, ...savedCourses];
        setSavedCourses(updated);
        localStorage.setItem(`course_${c.id}`, JSON.stringify(c));
    }
  };

  const loadCourse = (id: string) => {
    const raw = localStorage.getItem(`course_${id}`);
    if (raw) {
      setCourse(JSON.parse(raw));
      setVideoIds({});
      setExpandedModules({});
      setSelectedLesson(null);
    }
  };

  const deleteCourse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCourses.filter(c => c.id !== id);
    setSavedCourses(updated);
    localStorage.removeItem(`course_${id}`);
    if (course?.id === id) setCourse(null);
  };

  const toggleModule = (idx: number) => {
    setExpandedModules(prev => ({...prev, [idx]: !prev[idx]}));
  };

  const handleLessonClick = async (moduleIdx: number, lessonIdx: number, query: string) => {
    setSelectedLesson({ moduleIdx, lessonIdx });
    
    // Fetch video if not already cached and key exists
    const key = `${moduleIdx}-${lessonIdx}`;
    if (!videoIds[key] && settings.youtubeKey) {
      const ytService = new YouTubeService(settings.youtubeKey);
      const videoId = await ytService.searchVideo(query + " tutorial");
      if (videoId) {
        setVideoIds(prev => ({ ...prev, [key]: videoId }));
      }
    }
  };

  const generatePDF = useCallback(async () => {
    if (!certificateRef.current || !course) return;
    
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2, // High res
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1123, 794] // Match the CSS size
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 1123, 794);
      pdf.save(`${course.title.replace(/\s+/g, '_')}_Certificate.pdf`);
      setShowCertificateModal(false);
    } catch (err) {
      console.error("PDF Error", err);
      alert("Failed to generate PDF");
    }
  }, [course]);

  // --- Render ---

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold hidden sm:block">AI CourseGen</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              {theme === 'light' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5"/>}
            </button>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                !settings.geminiKey ? 'bg-red-100 text-red-700 animate-pulse' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar: Controls & History */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Generator Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              Generate Course
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic</label>
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. React Native, Pottery..." 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level</label>
                <select 
                  value={level}
                  onChange={(e) => setLevel(e.target.value as CourseLevel)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {Object.values(CourseLevel).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration: {duration} Hours
                </label>
                <input 
                  type="range" 
                  min="2" max="20" step="1" 
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Generating...
                  </>
                ) : 'Create Course'}
              </button>
            </form>
          </div>

          {/* Saved Courses */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Saved Courses</h3>
                {savedCourses.length > 0 && (
                  <button onClick={() => {if(confirm('Clear all?')) {setSavedCourses([]); localStorage.clear();}}} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                )}
             </div>
             
             <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
               {savedCourses.length === 0 ? (
                 <p className="text-sm text-gray-400 text-center py-4">No history yet.</p>
               ) : (
                 savedCourses.map(s => (
                   <div 
                    key={s.id} 
                    onClick={() => loadCourse(s.id)}
                    className={`group p-3 rounded-lg border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all ${course?.id === s.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50'}`}
                   >
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-medium line-clamp-2">{s.title}</h4>
                        <button 
                          onClick={(e) => deleteCourse(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs text-gray-400 mt-1 block">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                   </div>
                 ))
               )}
             </div>
          </div>
        </aside>

        {/* Center: Course Content */}
        <section className="lg:col-span-9 min-h-[500px]">
          {/* Settings Modal (Overlay) */}
          {showSettings && (
             <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in">
                   <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
                   <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                     <SettingsIcon className="w-5 h-5" /> Settings
                   </h2>
                   
                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-medium mb-1">Gemini API Key <span className="text-red-500">*</span></label>
                       <input 
                        type="password" 
                        value={settings.geminiKey}
                        onChange={e => setSettings({...settings, geminiKey: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="AIzaSy..."
                       />
                       <p className="text-xs text-gray-500 mt-1">Required to generate course content.</p>
                     </div>

                     <div>
                       <label className="block text-sm font-medium mb-1">YouTube API Key (Optional)</label>
                       <input 
                        type="password" 
                        value={settings.youtubeKey}
                        onChange={e => setSettings({...settings, youtubeKey: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="AIzaSy..."
                       />
                       <p className="text-xs text-gray-500 mt-1">Required to fetch relevant videos automatically.</p>
                     </div>

                     <div className="border-t dark:border-gray-700 pt-4 mt-2">
                        <h3 className="font-medium text-sm mb-2">Certificate Defaults</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500">Your Name</label>
                            <input 
                              type="text" 
                              value={settings.userName}
                              onChange={e => setSettings({...settings, userName: e.target.value})}
                              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                            />
                          </div>
                           <div>
                            <label className="text-xs text-gray-500">University/Org</label>
                            <input 
                              type="text" 
                              value={settings.university}
                              onChange={e => setSettings({...settings, university: e.target.value})}
                              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                            />
                          </div>
                        </div>
                     </div>
                   </div>

                   <button onClick={() => setShowSettings(false)} className="w-full mt-6 bg-gray-900 dark:bg-gray-700 text-white py-2 rounded-lg hover:opacity-90">
                     Save Settings
                   </button>
                </div>
             </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-6">
              {error}
            </div>
          )}

          {course ? (
            <div className="animate-fade-in space-y-6">
              {/* Course Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8"></div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 relative z-10">{course.title}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 relative z-10">
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                    {course.level}
                  </span>
                  <span className="flex items-center gap-1">
                    🕒 {course.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    📚 {course.modules.length} Modules
                  </span>
                </div>
                
                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => setShowCertificateModal(true)}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <Award className="w-4 h-4" /> Get Certificate
                  </button>
                  <button 
                    onClick={() => {
                        const blob = new Blob([JSON.stringify(course, null, 2)], {type: 'application/json'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${course.title}.json`;
                        a.click();
                    }}
                    className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" /> Export JSON
                  </button>
                </div>
              </div>

              {/* Course Modules Accordion */}
              <div className="space-y-4">
                {course.modules.map((module, mIdx) => (
                  <div key={mIdx} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <button 
                      onClick={() => toggleModule(mIdx)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Module {mIdx + 1}: {module.title}
                      </h3>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedModules[mIdx] ? 'rotate-180' : ''}`} />
                    </button>

                    {expandedModules[mIdx] && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {module.lessons.map((lesson, lIdx) => {
                          const isSelected = selectedLesson?.moduleIdx === mIdx && selectedLesson?.lessonIdx === lIdx;
                          return (
                            <div key={lIdx} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                <button
                                  onClick={() => handleLessonClick(mIdx, lIdx, lesson.youtubeQuery)}
                                  className={`w-full text-left p-4 px-6 flex items-center gap-3 hover:bg-white dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-white dark:bg-gray-700 border-l-4 border-blue-500' : ''}`}
                                >
                                  <div className={`p-2 rounded-full ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
                                     <PlayCircle className="w-4 h-4" />
                                  </div>
                                  <span className={`font-medium ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {lesson.title}
                                  </span>
                                </button>

                                {/* Lesson Detail View */}
                                {isSelected && (
                                  <div className="p-6 bg-white dark:bg-gray-800 animate-fade-in">
                                     {/* Video Embed */}
                                     <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 shadow-lg relative">
                                       {videoIds[`${mIdx}-${lIdx}`] ? (
                                         <>
                                            <iframe 
                                              width="100%" 
                                              height="100%" 
                                              src={`https://www.youtube.com/embed/${videoIds[`${mIdx}-${lIdx}`]}?rel=0`}
                                              title="YouTube video player" 
                                              frameBorder="0" 
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                              allowFullScreen
                                            ></iframe>
                                         </>
                                       ) : (
                                         <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                            {settings.youtubeKey ? (
                                                <span>Searching for video...</span>
                                            ) : (
                                                <div className="text-center p-4">
                                                    <p>Video embedding requires a YouTube API Key.</p>
                                                </div>
                                            )}
                                         </div>
                                       )}
                                     </div>
                                     {/* Fallback Link for Video Errors */}
                                     <div className="mb-6 text-right">
                                        <a 
                                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.youtubeQuery)}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-xs text-blue-500 hover:text-blue-700 underline"
                                        >
                                            Issues playing? Watch on YouTube
                                        </a>
                                     </div>

                                     {/* Content */}
                                     <div className="prose dark:prose-invert max-w-none">
                                        <h4 className="text-xl font-bold mb-4">Lesson Notes</h4>
                                        <div className="whitespace-pre-line text-gray-600 dark:text-gray-300 leading-relaxed">
                                            {lesson.content}
                                        </div>
                                        
                                        {lesson.codeSnippet && (
                                            <div className="mt-6">
                                                <h5 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Code Example</h5>
                                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
                                                    <code>{lesson.codeSnippet}</code>
                                                </pre>
                                            </div>
                                        )}
                                     </div>
                                  </div>
                                )}
                            </div>
                          );
                        })}

                        {/* Module Quiz Section */}
                        {module.quiz && module.quiz.length > 0 && (
                          <div className="p-6">
                            <ModuleQuiz questions={module.quiz} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
             !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                   <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-full mb-4">
                      <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                   </div>
                   <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Ready to learn?</h3>
                   <p className="max-w-md mt-2">Enter a topic on the left and generate a custom AI-powered course instantly.</p>
                </div>
             )
          )}
        </section>
      </main>

      {/* Certificate Modal */}
      {showCertificateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 relative">
              <button onClick={() => setShowCertificateModal(false)} className="absolute top-4 right-4 text-gray-400">✕</button>
              
              <div className="text-center mb-6">
                 <div className="inline-flex p-3 bg-yellow-100 text-yellow-600 rounded-full mb-3">
                    <Award className="w-8 h-8" />
                 </div>
                 <h2 className="text-2xl font-bold">Claim Your Certificate</h2>
                 <p className="text-gray-500 mt-2">Enter your details to generate your PDF certificate.</p>
              </div>

              <div className="space-y-4">
                 <input 
                   type="text" 
                   placeholder="Full Name"
                   value={settings.userName}
                   onChange={e => setSettings({...settings, userName: e.target.value})}
                   className="w-full px-4 py-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                 />
                 <input 
                   type="text" 
                   placeholder="University or Organization (Optional)"
                   value={settings.university}
                   onChange={e => setSettings({...settings, university: e.target.value})}
                   className="w-full px-4 py-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                 />
                 
                 <button 
                  onClick={generatePDF}
                  disabled={!settings.userName}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-lg shadow-yellow-500/30 transition-all transform hover:-translate-y-1 flex justify-center items-center gap-2"
                 >
                    <Download className="w-5 h-5" /> Download Certificate
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Hidden Certificate Render Area */}
      {course && (
        <Certificate 
            ref={certificateRef} 
            course={course} 
            studentName={settings.userName} 
            university={settings.university} 
        />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-8 bg-white dark:bg-gray-800">
         <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
            AI Course Generator &copy; {new Date().getFullYear()}. Client-side processing using Gemini API.
         </div>
      </footer>
    </div>
  );
}

export default App;
