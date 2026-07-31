import type { BookLibraryReference } from "../types/reading";

type BookLibraryReferenceResponse = {
  libraryReference: BookLibraryReference | null;
};

export const fetchBookLibraryReference = async (
  isbn: string | undefined,
  title?: string,
): Promise<BookLibraryReference | undefined> => {
  if (!isbn?.trim()) return undefined;

  try {
    const response = await fetch("/api/book-library-reference", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isbn, title }),
    });

    if (!response.ok) return undefined;

    const data = (await response.json()) as BookLibraryReferenceResponse;
    return data.libraryReference ?? undefined;
  } catch {
    return undefined;
  }
};
