/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  BarChart3, 
  BookOpen, 
  PenTool, 
  ChevronRight,
  Save,
  RefreshCw,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface QuestionAnalysis {
  id: string;
  questionNumber: number;
  questionText: string;
  studentAnswer: string;
  marks: number;
  maxMarks: number;
  relevancyRate: number; // 0-100
  reasoning: string;
  topic: string;
  type: 'short' | 'long';
}

interface GradingInsights {
  strengths: string[];
  weaknesses: string[];
  handwritingScore: number;
  relevancyScore: number;
  sentenceFormationScore: number;
  overallFeedback: string;
  shortVsLongComparison: string;
}

interface AnalysisResult {
  studentName: string;
  questions: QuestionAnalysis[];
  insights: GradingInsights;
  totalScore: number;
}

// --- Constants ---

const CLASSES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
const SUBJECTS = [
  'Mathematics', 
  'Science', 
  'Social Science', 
  'English', 
  'Hindi', 
  'Sanskrit', 
  'Physics', 
  'Chemistry', 
  'Biology', 
  'History', 
  'Geography', 
  'Economics', 
  'Political Science',
  'Computer Applications'
];

// --- Components ---

export default function App() {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const topicPerformance = useMemo(() => {
    if (!result) return [];
    const topics: Record<string, { totalMarks: number; maxMarks: number; count: number }> = {};
    result.questions.forEach(q => {
      if (!topics[q.topic]) {
        topics[q.topic] = { totalMarks: 0, maxMarks: 0, count: 0 };
      }
      topics[q.topic].totalMarks += q.marks;
      topics[q.topic].maxMarks += q.maxMarks;
      topics[q.topic].count += 1;
    });
    return Object.entries(topics).map(([name, data]) => ({
      name,
      percentage: Math.round((data.totalMarks / data.maxMarks) * 100),
      count: data.count
    })).sort((a, b) => b.percentage - a.percentage);
  }, [result]);

  const saveAnalysis = () => {
    if (!result) return;
    setSaveStatus('saving');
    
    try {
      const savedAnalyses = JSON.parse(localStorage.getItem('saved_analyses') || '[]');
      const newSave = {
        ...result,
        id: Date.now().toString(),
        savedAt: new Date().toISOString(),
        class: selectedClass,
        subject: selectedSubject
      };
      localStorage.setItem('saved_analyses', JSON.stringify([newSave, ...savedAnalyses]));
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save analysis:', err);
      setSaveStatus('idle');
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const analyzePaper = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const base64File = await fileToBase64(file);
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please set it in your environment variables.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              {
                text: `Analyze this student's exam answer sheet for ${selectedSubject} (${selectedClass}) following the Indian curriculum (e.g., CBSE/ICSE). 
                Extract all questions and answers. Evaluate them based on:
                1. Relevancy to the question.
                2. Correctness (partial or full).
                3. Handwriting legibility.
                4. Sentence formation.
                
                Provide a detailed breakdown for each question and overall insights.
                Specifically mention if the student performs better in short answers vs long answers.
                Assign marks out of a reasonable total (e.g., 1, 2, 3, 5, or 10 per question as per typical Indian marking schemes) that sums up to 100 overall if possible, or normalize it.
                `
              },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64File.split(',')[1]
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              studentName: { type: Type.STRING },
              totalScore: { type: Type.NUMBER },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    questionNumber: { type: Type.NUMBER },
                    questionText: { type: Type.STRING },
                    studentAnswer: { type: Type.STRING },
                    marks: { type: Type.NUMBER },
                    maxMarks: { type: Type.NUMBER },
                    relevancyRate: { type: Type.NUMBER },
                    reasoning: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['short', 'long'] }
                  },
                  required: ['id', 'questionNumber', 'questionText', 'studentAnswer', 'marks', 'maxMarks', 'relevancyRate', 'reasoning', 'topic', 'type']
                }
              },
              insights: {
                type: Type.OBJECT,
                properties: {
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                  handwritingScore: { type: Type.NUMBER },
                  relevancyScore: { type: Type.NUMBER },
                  sentenceFormationScore: { type: Type.NUMBER },
                  overallFeedback: { type: Type.STRING },
                  shortVsLongComparison: { type: Type.STRING }
                },
                required: ['strengths', 'weaknesses', 'handwritingScore', 'relevancyScore', 'sentenceFormationScore', 'overallFeedback', 'shortVsLongComparison']
              }
            },
            required: ['studentName', 'totalScore', 'questions', 'insights']
          }
        }
      });

      const data = JSON.parse(response.text);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze the paper. Please ensure the PDF is clear and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const updateQuestionMarks = (id: string, newMarks: number) => {
    if (!result) return;
    const updatedQuestions = result.questions.map(q => 
      q.id === id ? { ...q, marks: Math.min(newMarks, q.maxMarks) } : q
    );
    const newTotal = updatedQuestions.reduce((acc, q) => acc + q.marks, 0);
    setResult({ ...result, questions: updatedQuestions, totalScore: newTotal });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">ExamGrade AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-transparent text-sm font-medium px-3 py-1.5 outline-none cursor-pointer hover:bg-white rounded-md transition-colors"
              >
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="w-px h-4 bg-gray-300" />
              <select 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-transparent text-sm font-medium px-3 py-1.5 outline-none cursor-pointer hover:bg-white rounded-md transition-colors"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!result ? (
          <div className="max-w-2xl mx-auto mt-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold tracking-tight mb-4">Grade with Precision</h2>
              <p className="text-gray-500 text-lg">Upload a student's answer sheet to get deep AI-powered insights and automated grading.</p>
            </motion.div>

            <div 
              {...getRootProps()} 
              className={cn(
                "relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 p-12 flex flex-col items-center justify-center gap-4",
                isDragActive ? "border-indigo-500 bg-indigo-50/50" : "border-gray-200 hover:border-indigo-400 hover:bg-white"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">
                  {file ? file.name : "Drop student answer sheet here"}
                </p>
                <p className="text-sm text-gray-500 mt-1">PDF files only, up to 10MB</p>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}

            <div className="mt-8 flex justify-center">
              <button
                onClick={analyzePaper}
                disabled={!file || isAnalyzing}
                className={cn(
                  "px-8 py-4 rounded-2xl font-semibold text-white transition-all flex items-center gap-2 shadow-lg shadow-indigo-200",
                  !file || isAnalyzing ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Analyzing Paper...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5" />
                    Start Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Summary & Insights */}
            <div className="lg:col-span-4 space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Student Name</p>
                    <h3 className="text-2xl font-bold text-gray-900">{result.studentName}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Score</p>
                    <div className="text-4xl font-black text-indigo-600">
                      {result.totalScore}<span className="text-lg text-gray-400 font-normal">/100</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <ScoreMetric label="Handwriting" score={result.insights.handwritingScore} />
                  <ScoreMetric label="Relevancy" score={result.insights.relevancyScore} />
                  <ScoreMetric label="Sentence Formation" score={result.insights.sentenceFormationScore} />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm"
              >
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Key Strengths
                </h4>
                <div className="flex flex-wrap gap-2 mb-8">
                  {result.insights.strengths.map((s, i) => (
                    <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full border border-emerald-100">
                      {s}
                    </span>
                  ))}
                </div>

                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-amber-500" />
                  Areas for Improvement
                </h4>
                <div className="flex flex-wrap gap-2 mb-8">
                  {result.insights.weaknesses.map((w, i) => (
                    <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 text-sm font-medium rounded-full border border-amber-100">
                      {w}
                    </span>
                  ))}
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <h5 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Performance Insight
                  </h5>
                  <p className="text-sm text-indigo-800 leading-relaxed">
                    {result.insights.shortVsLongComparison}
                  </p>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-500" />
                    Topic-wise Performance
                  </h4>
                  <div className="space-y-4">
                    {topicPerformance.map((topic, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-medium text-gray-700">{topic.name}</span>
                          <span className="text-xs font-bold text-indigo-600">{topic.percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${topic.percentage}%` }}
                            className={cn(
                              "h-full rounded-full",
                              topic.percentage > 80 ? "bg-emerald-500" : topic.percentage > 50 ? "bg-indigo-500" : "bg-amber-500"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={saveAnalysis}
                  disabled={saveStatus !== 'idle'}
                  className={cn(
                    "w-full py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm",
                    saveStatus === 'saved' 
                      ? "bg-emerald-500 text-white" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  )}
                >
                  {saveStatus === 'saving' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : saveStatus === 'saved' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Analysis Saved!' : 'Save Analysis'}
                </button>

                <button 
                  onClick={() => setResult(null)}
                  className="w-full py-4 rounded-2xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Analyze New Paper
                </button>
              </div>
            </div>

            {/* Right Column: Question Breakdown */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold tracking-tight">Question Breakdown</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">
                    {result.questions.length} Questions Found
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {result.questions.map((q, idx) => (
                  <motion.div 
                    key={q.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Question {q.questionNumber}</span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full uppercase font-bold",
                              q.type === 'long' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                            )}>
                              {q.type} Answer
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase font-bold">
                              {q.topic}
                            </span>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 leading-snug">{q.questionText}</h4>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                            <input 
                              type="number" 
                              value={q.marks}
                              onChange={(e) => updateQuestionMarks(q.id, Number(e.target.value))}
                              className="w-12 bg-white border border-gray-200 rounded-lg px-2 py-1 text-center font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-gray-400 font-medium">/ {q.maxMarks}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-500",
                                  q.relevancyRate > 80 ? "bg-emerald-500" : q.relevancyRate > 50 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${q.relevancyRate}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gray-500">{q.relevancyRate}% Relevancy</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student's Answer</p>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-sm text-gray-700 italic leading-relaxed">
                            "{q.studentAnswer}"
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI Reasoning & Feedback</p>
                          <div className="p-4 bg-white rounded-2xl border border-indigo-50 text-sm text-gray-600 leading-relaxed">
                            {q.reasoning}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <GraduationCap className="w-5 h-5" />
            <span className="font-semibold">ExamGrade AI</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 ExamGrade AI. Precision grading for modern educators.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ScoreMetric({ label, score }: { label: string, score: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold text-indigo-600">{score}/10</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            score > 8 ? "bg-emerald-500" : score > 5 ? "bg-indigo-500" : "bg-amber-500"
          )}
        />
      </div>
    </div>
  );
}
