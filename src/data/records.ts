import type { ReadingRecord } from '../types/reading'

export const initialRecords: ReadingRecord[] = [
  {
    id: 'record-1',
    bookId: 'book-1',
    bookTitle: '작은 서점의 밤',
    date: '2026.05.19',
    durationSeconds: 2460,
    startPage: 111,
    endPage: 134,
    sentence: '천천히 읽은 문장은 오래 남는다.',
    sentencePage: 42,
  },
  {
    id: 'record-2',
    bookId: 'book-2',
    bookTitle: '올리브 숲 산책',
    date: '2026.05.18',
    durationSeconds: 1800,
    startPage: 64,
    endPage: 81,
  },
]
