import type { BookSearchResult } from '../types/reading'

type KakaoBookDocument = {
  title: string
  contents: string
  isbn: string
  authors: string[]
  publisher: string
  thumbnail: string
}

type KakaoBookResponse = {
  documents: KakaoBookDocument[]
}

const KAKAO_BOOK_SEARCH_URL = 'https://dapi.kakao.com/v3/search/book'
const kakaoRestApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY

export const hasKakaoBookApiKey = Boolean(kakaoRestApiKey)

export const searchKakaoBooks = async (query: string): Promise<BookSearchResult[]> => {
  const trimmedQuery = query.trim()

  if (!kakaoRestApiKey) {
    throw new Error('Kakao REST API 키가 설정되지 않았습니다.')
  }

  if (!trimmedQuery) {
    return []
  }

  const params = new URLSearchParams({
    query: trimmedQuery,
    sort: 'accuracy',
    size: '8',
  })

  const response = await fetch(`${KAKAO_BOOK_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Authorization: `KakaoAK ${kakaoRestApiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error('카카오 책 검색에 실패했습니다.')
  }

  const data = (await response.json()) as KakaoBookResponse

  return data.documents.map((book, index) => ({
    id: book.isbn || `${book.title}-${index}`,
    title: book.title,
    authors: book.authors,
    publisher: book.publisher,
    isbn: book.isbn,
    thumbnail: book.thumbnail || undefined,
    contents: book.contents,
  }))
}
