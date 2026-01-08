export enum CourseLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // 0-based index
  explanation?: string;
}

export interface Lesson {
  title: string;
  content: string; // Markdown supported
  youtubeQuery: string;
  codeSnippet?: string; // Optional code example
}

export interface Module {
  title: string;
  lessons: Lesson[];
  quiz: QuizQuestion[];
}

export interface Course {
  id: string;
  title: string;
  topic: string;
  level: CourseLevel;
  duration: string;
  modules: Module[];
  createdAt: number;
}

export interface AppSettings {
  geminiKey: string;
  youtubeKey: string;
  userName: string;
  university: string;
}

export interface SavedCourseStub {
  id: string;
  title: string;
  createdAt: number;
}
