export const clampBookPage = (page: number, totalPages: number | null, minimum = 1) => {
  const normalizedPage = Math.max(Math.floor(page) || minimum, minimum)

  return totalPages ? Math.min(normalizedPage, totalPages) : normalizedPage
}

export const getBookProgress = (currentPage: number, totalPages: number | null) =>
  totalPages ? Math.min(Math.round((currentPage / totalPages) * 100), 100) : null

export const isBookCompletedByPage = (currentPage: number, totalPages: number | null) =>
  totalPages !== null && currentPage >= totalPages

export const formatBookPages = (currentPage: number, totalPages: number | null) =>
  totalPages ? `${currentPage}/${totalPages}p` : `${currentPage}p`
