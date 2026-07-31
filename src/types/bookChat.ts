export type BookChatEvidenceType =
  | "bookInfo"
  | "external"
  | "quote"
  | "record"
  | "pattern"
  | "report"
  | "tier"
  | "comparison";

export type BookChatEvidence = {
  type: BookChatEvidenceType;
  label: string;
  detail: string;
};

export type BookChatResponse = {
  answer: string;
  evidence: BookChatEvidence[];
  followUpQuestions: string[];
};

export type BookChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: BookChatEvidence[];
  followUpQuestions?: string[];
  createdAt: string;
};

export type CompletedBookChatContext = {
  book: {
    id: string;
    title: string;
    author: string;
    publisher?: string;
    isbn?: string;
    contents?: string;
    libraryReference?: {
      source: string;
      title?: string;
      summary: string;
      contents?: string;
      recommendedBooks: Array<{
        title: string;
        author?: string;
      }>;
      nationalLibrary?: {
        source?: string;
        title?: string;
        author?: string;
        isbn?: string;
        setIsbn?: string;
        publisher?: string;
        edition?: string;
        page?: string;
        bookSize?: string;
        form?: string;
        subject?: string;
        ebookYn?: string;
        cipYn?: string;
        coverUrl?: string;
        tocUrl?: string;
        introductionUrl?: string;
        summaryUrl?: string;
        inputDate?: string;
        updateDate?: string;
        syncedAt?: string;
      };
      data4LibraryCheckedAt?: string;
      nationalLibraryCheckedAt?: string;
      syncedAt: string;
    };
    totalPages: number | null;
    startedAt: string;
    completedAt?: string;
    tier: string | null;
  };
  reading: {
    totalSeconds: number;
    recordedPages: number;
    sessionCount: number;
    completedDays: number | null;
    averageSessionSeconds: number;
    pagesPerHour: number;
    topWeekday: string;
    topTimeBand: string;
  };
  sentences: Array<{
    id: string;
    text: string;
    page: number;
    recordedAt: string;
    section: "초반" | "중반" | "후반" | "전체";
  }>;
  report: {
    leadTitle: string;
    leadDescription: string;
    focusInsight: string;
    rhythmInsight: string;
    graphInsight: string;
    journeySummary: string;
    keywords: string[];
  } | null;
  pattern: {
    typeLabel: string;
    summary: string;
    sentenceDensity: number;
    sentencePeak: string;
  } | null;
  comparison: Array<{
    id: string;
    title: string;
    author: string;
    tier: string | null;
    sentenceCount: number;
    completedAt?: string;
  }>;
};
