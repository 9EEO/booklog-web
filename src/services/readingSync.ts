import { defaultDailyGoalSeconds, defaultWeeklyGoalDays } from '../storage/readingStorage'
import { requireSupabase } from './supabase'
import type { Book, BookStatus, Highlight, NewBookInput, ReadingRecord, ReadingRound } from '../types/reading'
import { createEmptyTierBoard, normalizeTierBoard, type TierBoard } from '../types/tier'

type BookRow = {
  id: string
  user_id: string
  title: string
  author: string
  total_pages: number | null
  current_page: number
  started_at: string | null
  completed_at: string | null
  accumulated_seconds: number
  status: BookStatus
  cover_color: string
  accent_color: string
  thumbnail: string | null
}

type HighlightRow = {
  id: string
  user_id: string
  book_id: string
  text: string
  page: number
  recorded_at: string
}

type ReadingRoundRow = {
  id: string
  user_id: string
  book_id: string
  round_number: number
  status: BookStatus
  current_page: number
  started_at: string | null
  completed_at: string | null
  accumulated_seconds: number
}

type ReadingRecordRow = {
  id: string
  user_id: string
  book_id: string
  round_id?: string | null
  book_title: string | null
  read_date: string
  session_started_at?: string | null
  session_ended_at?: string | null
  duration_seconds: number
  start_page: number
  end_page: number
  sentence: string | null
  sentence_page: number | null
}

type ReadingSettingsRow = {
  user_id: string
  current_book_id: string | null
  daily_goal_seconds: number | null
  weekly_goal_days: number | null
  tier_board?: unknown
}

export type ReadingSnapshot = {
  books: Book[]
  records: ReadingRecord[]
  currentBookId: string
  dailyGoalSeconds: number
  weeklyGoalDays: number
  tierBoard: TierBoard
}

const normalizeDate = (value: string) => value.replace(/-/g, '.')
const toDbDate = (value: string) => value.replace(/\./g, '-')

const mapHighlightRow = (row: HighlightRow): Highlight => ({
  id: row.id,
  text: row.text,
  page: row.page,
  recordedAt: normalizeDate(row.recorded_at),
})

const mapRoundRow = (row: ReadingRoundRow): ReadingRound => ({
  id: row.id,
  bookId: row.book_id,
  roundNumber: row.round_number,
  status: row.status,
  currentPage: row.current_page,
  startedAt: row.started_at ? normalizeDate(row.started_at) : '',
  completedAt: row.completed_at ? normalizeDate(row.completed_at) : undefined,
  accumulatedSeconds: row.accumulated_seconds,
})

const createFallbackRound = (row: BookRow): ReadingRound => ({
  id: `${row.id}-round-1`,
  bookId: row.id,
  roundNumber: 1,
  status: row.status,
  currentPage: row.current_page,
  startedAt: row.started_at ? normalizeDate(row.started_at) : '',
  completedAt: row.completed_at ? normalizeDate(row.completed_at) : undefined,
  accumulatedSeconds: row.accumulated_seconds,
})

const pickActiveRound = (rounds: ReadingRound[]) =>
  rounds.find((round) => round.status === 'reading') ??
  [...rounds].sort((left, right) => right.roundNumber - left.roundNumber)[0]

const mapBookRow = (row: BookRow, highlights: Highlight[], rounds: ReadingRound[]): Book => {
  const normalizedRounds = (rounds.length > 0 ? rounds : [createFallbackRound(row)]).sort((left, right) => left.roundNumber - right.roundNumber)
  const activeRound = pickActiveRound(normalizedRounds) ?? createFallbackRound(row)
  const latestCompletedAt =
    [...normalizedRounds]
      .reverse()
      .find((round) => round.completedAt)?.completedAt ?? (row.completed_at ? normalizeDate(row.completed_at) : undefined)

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    totalPages: row.total_pages,
    currentPage: activeRound.currentPage,
    startedAt: activeRound.startedAt,
    completedAt: activeRound.completedAt ?? latestCompletedAt,
    accumulatedSeconds: activeRound.accumulatedSeconds,
    status: activeRound.status,
    coverColor: row.cover_color,
    accentColor: row.accent_color,
    thumbnail: row.thumbnail ?? undefined,
    sentences: highlights,
    rounds: normalizedRounds,
    activeRoundId: activeRound.id,
    activeRoundNumber: activeRound.roundNumber,
  }
}

const mapRecordRow = (row: ReadingRecordRow, round?: ReadingRound): ReadingRecord => ({
  id: row.id,
  bookId: row.book_id,
  roundId: row.round_id ?? undefined,
  roundNumber: round?.roundNumber ?? 1,
  bookTitle: row.book_title ?? '제목 없음',
  date: normalizeDate(row.read_date),
  startedAt: row.session_started_at ?? undefined,
  endedAt: row.session_ended_at ?? undefined,
  durationSeconds: row.duration_seconds,
  startPage: row.start_page,
  endPage: row.end_page,
  sentence: row.sentence ?? undefined,
  sentencePage: row.sentence_page ?? undefined,
})

const buildSnapshot = (
  books: BookRow[],
  rounds: ReadingRoundRow[],
  records: ReadingRecordRow[],
  highlights: HighlightRow[],
  settings: ReadingSettingsRow | null,
): ReadingSnapshot => {
  const highlightsByBookId = new Map<string, Highlight[]>()
  const roundsByBookId = new Map<string, ReadingRound[]>()
  const roundsById = new Map<string, ReadingRound>()

  highlights.forEach((row) => {
    const current = highlightsByBookId.get(row.book_id) ?? []
    current.push(mapHighlightRow(row))
    highlightsByBookId.set(row.book_id, current)
  })

  rounds.forEach((row) => {
    const round = mapRoundRow(row)
    const current = roundsByBookId.get(row.book_id) ?? []

    current.push(round)
    roundsByBookId.set(row.book_id, current)
    roundsById.set(row.id, round)
  })

  return {
    books: books.map((row) => mapBookRow(row, highlightsByBookId.get(row.id) ?? [], roundsByBookId.get(row.id) ?? [])),
    records: records.map((row) => mapRecordRow(row, row.round_id ? roundsById.get(row.round_id) : undefined)),
    currentBookId: settings?.current_book_id ?? '',
    dailyGoalSeconds: settings?.daily_goal_seconds ?? defaultDailyGoalSeconds,
    weeklyGoalDays: settings?.weekly_goal_days ?? defaultWeeklyGoalDays,
    tierBoard: normalizeTierBoard(settings?.tier_board ?? createEmptyTierBoard()),
  }
}

export const fetchReadingSnapshot = async (userId: string): Promise<ReadingSnapshot> => {
  const supabase = requireSupabase()

  const [booksResult, roundsResult, recordsResult, highlightsResult, settingsResult] = await Promise.all([
    supabase.from('books').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('reading_rounds').select('*').eq('user_id', userId).order('round_number', { ascending: true }),
    supabase.from('reading_records').select('*').eq('user_id', userId).order('read_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('highlights').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('reading_settings').select('*').eq('user_id', userId).maybeSingle(),
  ])

  if (booksResult.error) throw booksResult.error
  if (roundsResult.error) throw roundsResult.error
  if (recordsResult.error) throw recordsResult.error
  if (highlightsResult.error) throw highlightsResult.error
  if (settingsResult.error) throw settingsResult.error

  return buildSnapshot(
    (booksResult.data ?? []) as BookRow[],
    (roundsResult.data ?? []) as ReadingRoundRow[],
    (recordsResult.data ?? []) as ReadingRecordRow[],
    (highlightsResult.data ?? []) as HighlightRow[],
    (settingsResult.data as ReadingSettingsRow | null) ?? null,
  )
}

export const saveReadingSettings = async (
  userId: string,
  input: { currentBookId: string; dailyGoalSeconds: number; weeklyGoalDays: number; tierBoard: TierBoard },
) => {
  const supabase = requireSupabase()
  const { error } = await supabase.from('reading_settings').upsert({
    user_id: userId,
    current_book_id: input.currentBookId || null,
    daily_goal_seconds: input.dailyGoalSeconds,
    weekly_goal_days: input.weeklyGoalDays,
    tier_board: normalizeTierBoard(input.tierBoard),
  })

  if (error) throw error
}

export const createRemoteBook = async (
  userId: string,
  input: NewBookInput,
  palette: { coverColor: string; accentColor: string },
  fallbackDate: string,
): Promise<Book> => {
  const supabase = requireSupabase()
  const totalPages = input.totalPages ? Math.max(Math.floor(input.totalPages), 1) : null
  const isCompletedInput = input.status === 'completed'
  const currentPage = isCompletedInput && totalPages
    ? totalPages
    : totalPages
      ? Math.min(Math.max(Math.floor(input.currentPage) || 1, 1), totalPages)
      : Math.max(Math.floor(input.currentPage) || 1, 1)
  const isCompletedByPage = totalPages !== null && currentPage >= totalPages
  const payload = {
    user_id: userId,
    title: input.title.trim(),
    author: input.author.trim() || '작가 미상',
    total_pages: totalPages,
    current_page: currentPage,
    started_at: input.startedAt?.trim() ? toDbDate(input.startedAt) : null,
    completed_at: isCompletedInput || isCompletedByPage ? toDbDate(input.completedAt?.trim() || fallbackDate) : null,
    accumulated_seconds: 0,
    status: (isCompletedInput || isCompletedByPage ? 'completed' : 'reading') as BookStatus,
    cover_color: palette.coverColor,
    accent_color: palette.accentColor,
    thumbnail: input.thumbnail ?? null,
  }

  const { data, error } = await supabase.from('books').insert(payload).select('*').single()
  if (error) throw error

  const createdBook = data as BookRow
  const { data: roundData, error: roundError } = await supabase
    .from('reading_rounds')
    .insert({
      user_id: userId,
      book_id: createdBook.id,
      round_number: 1,
      status: payload.status,
      current_page: currentPage,
      started_at: payload.started_at,
      completed_at: payload.completed_at,
      accumulated_seconds: 0,
    })
    .select('*')
    .single()

  if (roundError) throw roundError

  return mapBookRow(createdBook, [], [mapRoundRow(roundData as ReadingRoundRow)])
}

export const createRemoteReadingRound = async (
  userId: string,
  input: {
    bookId: string
    roundNumber: number
    startedAt: string
    currentPage?: number
  },
): Promise<ReadingRound> => {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('reading_rounds')
    .insert({
      user_id: userId,
      book_id: input.bookId,
      round_number: input.roundNumber,
      status: 'reading',
      current_page: input.currentPage ?? 1,
      started_at: toDbDate(input.startedAt),
      completed_at: null,
      accumulated_seconds: 0,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapRoundRow(data as ReadingRoundRow)
}

export const updateRemoteReadingRound = async (
  roundId: string,
  input: Partial<{
    currentPage: number
    accumulatedSeconds: number
    status: BookStatus
    startedAt: string | null
    completedAt: string | null
  }>,
) => {
  const supabase = requireSupabase()
  const payload: Record<string, unknown> = {}

  if (input.currentPage !== undefined) payload.current_page = input.currentPage
  if (input.accumulatedSeconds !== undefined) payload.accumulated_seconds = input.accumulatedSeconds
  if (input.status !== undefined) payload.status = input.status
  if (input.startedAt !== undefined) payload.started_at = input.startedAt ? toDbDate(input.startedAt) : null
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt ? toDbDate(input.completedAt) : null

  const { error } = await supabase.from('reading_rounds').update(payload).eq('id', roundId)
  if (error) throw error
}

export const createRemoteRecord = async (
  userId: string,
  input: {
    bookId: string
    roundId?: string
    roundNumber?: number
    bookTitle: string
    date: string
    startedAt?: string
    endedAt?: string
    durationSeconds: number
    startPage: number
    endPage: number
    sentence?: string
    sentencePage?: number
  },
): Promise<ReadingRecord> => {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('reading_records')
    .insert({
      user_id: userId,
      book_id: input.bookId,
      round_id: input.roundId ?? null,
      book_title: input.bookTitle,
      read_date: toDbDate(input.date),
      session_started_at: input.startedAt ?? null,
      session_ended_at: input.endedAt ?? null,
      duration_seconds: input.durationSeconds,
      start_page: input.startPage,
      end_page: input.endPage,
      sentence: input.sentence ?? null,
      sentence_page: input.sentencePage ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  return {
    ...mapRecordRow(data as ReadingRecordRow),
    roundNumber: input.roundNumber ?? 1,
  }
}

export const updateRemoteRecord = async (
  recordId: string,
  input: Partial<{
    date: string
    startedAt: string | null
    endedAt: string | null
    roundId: string | null
    roundNumber: number
    durationSeconds: number
    startPage: number
    endPage: number
    sentence: string | null
    sentencePage: number | null
  }>,
): Promise<ReadingRecord> => {
  const supabase = requireSupabase()
  const payload: Record<string, unknown> = {}

  if (input.date !== undefined) payload.read_date = toDbDate(input.date)
  if (input.startedAt !== undefined) payload.session_started_at = input.startedAt
  if (input.endedAt !== undefined) payload.session_ended_at = input.endedAt
  if (input.roundId !== undefined) payload.round_id = input.roundId
  if (input.durationSeconds !== undefined) payload.duration_seconds = input.durationSeconds
  if (input.startPage !== undefined) payload.start_page = input.startPage
  if (input.endPage !== undefined) payload.end_page = input.endPage
  if (input.sentence !== undefined) payload.sentence = input.sentence
  if (input.sentencePage !== undefined) payload.sentence_page = input.sentencePage

  const { data, error } = await supabase.from('reading_records').update(payload).eq('id', recordId).select('*').single()
  if (error) throw error

  return {
    ...mapRecordRow(data as ReadingRecordRow),
    roundNumber: input.roundNumber ?? 1,
  }
}

export const deleteRemoteRecord = async (recordId: string) => {
  const supabase = requireSupabase()
  const { error } = await supabase.from('reading_records').delete().eq('id', recordId)
  if (error) throw error
}

export const deleteRemoteRecordsByRound = async (roundId: string) => {
  const supabase = requireSupabase()
  const { error } = await supabase.from('reading_records').delete().eq('round_id', roundId)
  if (error) throw error
}

export const deleteRemoteReadingRound = async (roundId: string) => {
  const supabase = requireSupabase()
  const { error } = await supabase.from('reading_rounds').delete().eq('id', roundId)
  if (error) throw error
}

export const createRemoteHighlight = async (
  userId: string,
  input: { bookId: string; text: string; page: number; recordedAt: string },
): Promise<Highlight> => {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: userId,
      book_id: input.bookId,
      text: input.text.trim(),
      page: input.page,
      recorded_at: toDbDate(input.recordedAt),
    })
    .select('*')
    .single()

  if (error) throw error

  return mapHighlightRow(data as HighlightRow)
}

export const updateRemoteHighlight = async (highlightId: string, input: { text: string; page: number }) => {
  const supabase = requireSupabase()
  const { error } = await supabase
    .from('highlights')
    .update({
      text: input.text.trim(),
      page: input.page,
    })
    .eq('id', highlightId)

  if (error) throw error
}

export const deleteRemoteHighlight = async (highlightId: string) => {
  const supabase = requireSupabase()
  const { error } = await supabase.from('highlights').delete().eq('id', highlightId)
  if (error) throw error
}

export const updateRemoteBook = async (
  bookId: string,
  input: Partial<{
    totalPages: number | null
    currentPage: number
    accumulatedSeconds: number
    status: BookStatus
    startedAt: string | null
    completedAt: string | null
  }>,
) => {
  const supabase = requireSupabase()
  const payload: Record<string, unknown> = {}

  if (input.totalPages !== undefined) payload.total_pages = input.totalPages
  if (input.currentPage !== undefined) payload.current_page = input.currentPage
  if (input.accumulatedSeconds !== undefined) payload.accumulated_seconds = input.accumulatedSeconds
  if (input.status !== undefined) payload.status = input.status
  if (input.startedAt !== undefined) payload.started_at = input.startedAt ? toDbDate(input.startedAt) : null
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt ? toDbDate(input.completedAt) : null

  const { error } = await supabase.from('books').update(payload).eq('id', bookId)
  if (error) throw error
}

export const deleteRemoteBook = async (bookId: string) => {
  const supabase = requireSupabase()
  const { error } = await supabase.from('books').delete().eq('id', bookId)
  if (error) throw error
}

export const migrateLocalSnapshotToSupabase = async (
  userId: string,
  snapshot: ReadingSnapshot,
  palettes: Array<{ coverColor: string; accentColor: string }>,
) => {
  const bookIdMap = new Map<string, string>()
  const roundIdMap = new Map<string, string>()
  const migratedBooks: Book[] = []

  for (const [index, book] of snapshot.books.entries()) {
    const palette = {
      coverColor: book.coverColor || palettes[index % palettes.length].coverColor,
      accentColor: book.accentColor || palettes[index % palettes.length].accentColor,
    }

    const createdBook = await createRemoteBook(
      userId,
      {
        title: book.title,
        author: book.author,
        totalPages: book.totalPages,
        currentPage: book.currentPage,
        status: book.status,
        startedAt: book.startedAt,
        completedAt: book.completedAt,
        thumbnail: book.thumbnail,
      },
      palette,
      book.startedAt,
    )

    await updateRemoteBook(createdBook.id, {
      accumulatedSeconds: book.accumulatedSeconds,
      currentPage: book.currentPage,
      status: book.status,
      completedAt: book.completedAt ?? null,
    })

    if (createdBook.activeRoundId) {
      await updateRemoteReadingRound(createdBook.activeRoundId, {
        accumulatedSeconds: book.accumulatedSeconds,
        currentPage: book.currentPage,
        status: book.status,
        completedAt: book.completedAt ?? null,
      })
    }

    const migratedBook = {
      ...createdBook,
      accumulatedSeconds: book.accumulatedSeconds,
      currentPage: book.currentPage,
      status: book.status,
      completedAt: book.completedAt,
      rounds: createdBook.rounds?.map((round) => ({
        ...round,
        accumulatedSeconds: book.accumulatedSeconds,
        currentPage: book.currentPage,
        status: book.status,
        completedAt: book.completedAt,
      })),
    }

    migratedBooks.push(migratedBook)
    bookIdMap.set(book.id, createdBook.id)
    if (createdBook.activeRoundId) {
      roundIdMap.set(book.activeRoundId ?? `${book.id}-round-1`, createdBook.activeRoundId)
      roundIdMap.set(`${book.id}-round-1`, createdBook.activeRoundId)
    }

    for (const sentence of book.sentences) {
      const createdHighlight = await createRemoteHighlight(userId, {
        bookId: createdBook.id,
        text: sentence.text,
        page: sentence.page,
        recordedAt: sentence.recordedAt,
      })

      migratedBook.sentences = [...migratedBook.sentences, createdHighlight]
    }
  }

  const migratedRecords: ReadingRecord[] = []
  for (const record of snapshot.records) {
    const mappedBookId = bookIdMap.get(record.bookId)
    if (!mappedBookId) continue

    const createdRecord = await createRemoteRecord(userId, {
      bookId: mappedBookId,
      roundId: record.roundId ? roundIdMap.get(record.roundId) : roundIdMap.get(`${record.bookId}-round-1`),
      roundNumber: record.roundNumber ?? 1,
      bookTitle: record.bookTitle,
      date: record.date,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      durationSeconds: record.durationSeconds,
      startPage: record.startPage,
      endPage: record.endPage,
      sentence: record.sentence,
      sentencePage: record.sentencePage,
    })

    migratedRecords.push(createdRecord)
  }

  const mappedCurrentBookId = bookIdMap.get(snapshot.currentBookId) ?? migratedBooks[0]?.id ?? ''
  const migratedTierBoard = normalizeTierBoard(
    Object.fromEntries(
      Object.entries(snapshot.tierBoard).map(([tier, bookIds]) => [
        tier,
        bookIds.map((bookId) => bookIdMap.get(bookId)).filter((bookId): bookId is string => Boolean(bookId)),
      ]),
    ),
  )

  await saveReadingSettings(userId, {
    currentBookId: mappedCurrentBookId,
    dailyGoalSeconds: snapshot.dailyGoalSeconds,
    weeklyGoalDays: snapshot.weeklyGoalDays,
    tierBoard: migratedTierBoard,
  })

  return {
    books: migratedBooks,
    records: migratedRecords,
    currentBookId: mappedCurrentBookId,
    dailyGoalSeconds: snapshot.dailyGoalSeconds,
    weeklyGoalDays: snapshot.weeklyGoalDays,
    tierBoard: migratedTierBoard,
  } satisfies ReadingSnapshot
}
