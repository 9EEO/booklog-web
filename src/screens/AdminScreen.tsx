import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  deleteAdminLibraryReference,
  fetchAdminLibraryReferences,
  fetchAdminSummary,
  fetchAdminUserDetail,
  fetchAdminUsers,
  type AdminLibraryReferenceSummary,
  type AdminSummary,
  type AdminUserDetail,
  type AdminUserSummary,
} from "../services/adminApi";

type AdminScreenProps = {
  user: User;
  onSignOut: () => Promise<void>;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";

  return value.slice(0, 10);
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return "";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatReadingTimeRange = (
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
) => {
  const startTime = formatTime(startedAt);
  const endTime = formatTime(endedAt);

  if (startTime && endTime) return `${startTime}-${endTime}`;
  if (startTime) return `${startTime} 시작`;
  if (endTime) return `${endTime} 종료`;
  return "";
};

const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours > 0) return restMinutes > 0 ? `${hours}시간 ${restMinutes}분` : `${hours}시간`;
  return `${minutes}분`;
};

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const summaryCards = (summary: AdminSummary | null) => [
  { label: "전체 유저", value: summary?.totalUsers ?? 0 },
  { label: "최근 7일 활성", value: summary?.activeUsers7d ?? 0 },
  { label: "전체 책", value: summary?.totalBooks ?? 0 },
  { label: "완독 책", value: summary?.completedBooks ?? 0 },
  { label: "독서 기록", value: summary?.totalRecords ?? 0 },
  { label: "기록 문장", value: summary?.totalHighlights ?? 0 },
];

export const AdminScreen = ({ user, onSignOut }: AdminScreenProps) => {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [libraryReferences, setLibraryReferences] = useState<
    AdminLibraryReferenceSummary[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const selectedUserIdRef = useRef("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [referenceQuery, setReferenceQuery] = useState("");
  const [submittedReferenceQuery, setSubmittedReferenceQuery] = useState("");
  const [page, setPage] = useState(1);
  const [referencePage, setReferencePage] = useState(1);
  const [total, setTotal] = useState(0);
  const [referenceTotal, setReferenceTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReferencesLoading, setIsReferencesLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [deletingIsbn13, setDeletingIsbn13] = useState("");
  const [openReferenceIsbn13, setOpenReferenceIsbn13] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const referenceTotalPages = Math.max(
    Math.ceil(referenceTotal / pageSize),
    1,
  );

  const loadUserDetail = useCallback(async (userId: string) => {
    if (!userId) {
      setDetail(null);
      return;
    }

    setIsDetailLoading(true);

    try {
      const nextDetail = await fetchAdminUserDetail(userId);
      setDetail(nextDetail);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "유저 상세를 불러오지 못했습니다.",
      );
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextSummary, nextUsers] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminUsers({ page, pageSize, query: submittedQuery }),
      ]);

      setSummary(nextSummary);
      setUsers(nextUsers.users);
      setTotal(nextUsers.total);
      const nextSelectedUserId =
        selectedUserIdRef.current &&
        nextUsers.users.some((item) => item.id === selectedUserIdRef.current)
          ? selectedUserIdRef.current
          : nextUsers.users[0]?.id || "";

      selectedUserIdRef.current = nextSelectedUserId;
      setSelectedUserId(nextSelectedUserId);
      void loadUserDetail(nextSelectedUserId);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "관리자 데이터를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadUserDetail, page, submittedQuery]);

  const loadLibraryReferences = useCallback(async () => {
    setIsReferencesLoading(true);
    setError(null);

    try {
      const nextReferences = await fetchAdminLibraryReferences({
        page: referencePage,
        pageSize,
        query: submittedReferenceQuery,
      });

      setLibraryReferences(nextReferences.references);
      setReferenceTotal(nextReferences.total);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "외부 참고자료를 불러오지 못했습니다.",
      );
    } finally {
      setIsReferencesLoading(false);
    }
  }, [referencePage, submittedReferenceQuery]);

  useEffect(() => {
    const loadingTimeout = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => window.clearTimeout(loadingTimeout);
  }, [loadOverview]);

  useEffect(() => {
    const loadingTimeout = window.setTimeout(() => {
      void loadLibraryReferences();
    }, 0);

    return () => window.clearTimeout(loadingTimeout);
  }, [loadLibraryReferences]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const refreshAdmin = () => {
    void loadOverview();
    void loadLibraryReferences();
  };

  const deleteLibraryReference = async (
    reference: AdminLibraryReferenceSummary,
  ) => {
    const confirmed = window.confirm(
      `${reference.isbn13} 외부 참고자료 캐시를 삭제할까요?`,
    );

    if (!confirmed) return;

    setDeletingIsbn13(reference.isbn13);
    setError(null);

    try {
      await deleteAdminLibraryReference(reference.isbn13);
      await loadLibraryReferences();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "외부 참고자료를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingIsbn13("");
    }
  };

  return (
    <main className="admin-screen">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p>Booklog Admin</p>
            <h1>백오피스</h1>
            <span>{user.email}</span>
          </div>
          <div className="admin-header-actions">
            <a href="/">앱으로 이동</a>
            <button type="button" onClick={refreshAdmin}>
              새로고침
            </button>
            <button type="button" onClick={() => void onSignOut()}>
              로그아웃
            </button>
          </div>
        </header>

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-summary-grid">
          {summaryCards(summary).map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value.toLocaleString()}</strong>
            </article>
          ))}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>유저 목록</h2>
              <p>전체 {total.toLocaleString()}명</p>
            </div>
            <form
              className="admin-search"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSubmittedQuery(query);
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이메일 또는 user id 검색"
              />
              <button type="submit">검색</button>
            </form>
          </div>

          <div className="admin-layout">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>이메일</th>
                    <th>책</th>
                    <th>완독</th>
                    <th>기록</th>
                    <th>문장</th>
                    <th>총 시간</th>
                    <th>최근 독서</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7}>불러오는 중입니다.</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7}>조회된 유저가 없습니다.</td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.id === selectedUserId ? "admin-row-active" : ""
                        }
                        onClick={() => {
                          selectedUserIdRef.current = item.id;
                          setSelectedUserId(item.id);
                          void loadUserDetail(item.id);
                        }}
                      >
                        <td>
                          <button type="button">{item.email}</button>
                          <small>{item.id}</small>
                        </td>
                        <td>{item.bookCount}</td>
                        <td>{item.completedBookCount}</td>
                        <td>{item.recordCount}</td>
                        <td>{item.highlightCount}</td>
                        <td>{formatDuration(item.totalSeconds)}</td>
                        <td>{formatDate(item.recentReadDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="admin-pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  이전
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(current + 1, totalPages))
                  }
                >
                  다음
                </button>
              </div>
            </div>

            <aside className="admin-detail">
              <div className="admin-detail-header">
                <h2>유저 상세</h2>
                {selectedUser && <p>{selectedUser.email}</p>}
              </div>
              {isDetailLoading ? (
                <p className="admin-empty">상세 데이터를 불러오는 중입니다.</p>
              ) : detail ? (
                <>
                  <div className="admin-detail-stats">
                    <span>가입 {formatDate(detail.user.createdAt)}</span>
                    <span>최근 로그인 {formatDate(detail.user.lastSignInAt)}</span>
                    <span>책 {detail.books.length}권</span>
                    <span>기록 {detail.records.length}개</span>
                  </div>

                  <div className="admin-detail-section">
                    <h3>책</h3>
                    {detail.books.slice(0, 8).map((book) => (
                      <div key={book.id} className="admin-detail-item">
                        <strong>{book.title}</strong>
                        <span>
                          {book.author} · {book.status} · {book.current_page}
                          {book.total_pages ? `/${book.total_pages}p` : "p"}
                        </span>
                      </div>
                    ))}
                    {detail.books.length === 0 && (
                      <p className="admin-empty">등록한 책이 없습니다.</p>
                    )}
                  </div>

                  <div className="admin-detail-section">
                    <h3>최근 기록</h3>
                    {detail.records.slice(0, 8).map((record) => {
                      const timeRange = formatReadingTimeRange(
                        record.session_started_at,
                        record.session_ended_at,
                      );

                      return (
                        <div key={record.id} className="admin-detail-item">
                          <strong>{record.book_title ?? "제목 없음"}</strong>
                          <span>
                            {formatDate(record.read_date)} ·{" "}
                            {timeRange ? `${timeRange} · ` : ""}
                            {formatDuration(record.duration_seconds)} ·{" "}
                            {record.start_page}-{record.end_page}p
                          </span>
                        </div>
                      );
                    })}
                    {detail.records.length === 0 && (
                      <p className="admin-empty">독서 기록이 없습니다.</p>
                    )}
                  </div>

                  <div className="admin-detail-section">
                    <h3>기록한 문장</h3>
                    {detail.highlights.slice(0, 5).map((highlight) => (
                      <blockquote key={highlight.id}>
                        <p>{highlight.text}</p>
                        <span>{highlight.page}p</span>
                      </blockquote>
                    ))}
                    {detail.highlights.length === 0 && (
                      <p className="admin-empty">기록한 문장이 없습니다.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="admin-empty">유저를 선택해주세요.</p>
              )}
            </aside>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>외부 도서 자료</h2>
              <p>전체 {referenceTotal.toLocaleString()}건</p>
            </div>
            <form
              className="admin-search"
              onSubmit={(event) => {
                event.preventDefault();
                setReferencePage(1);
                setSubmittedReferenceQuery(referenceQuery);
              }}
            >
              <input
                value={referenceQuery}
                onChange={(event) => setReferenceQuery(event.target.value)}
                placeholder="ISBN, 제목, 내용 검색"
              />
              <button type="submit">검색</button>
            </form>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table admin-reference-table">
              <thead>
                <tr>
                  <th>ISBN</th>
                  <th>제목</th>
                  <th>출처</th>
                  <th>추천책</th>
                  <th>갱신일</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {isReferencesLoading ? (
                  <tr>
                    <td colSpan={6}>불러오는 중입니다.</td>
                  </tr>
                ) : libraryReferences.length === 0 ? (
                  <tr>
                    <td colSpan={6}>저장된 외부 참고자료가 없습니다.</td>
                  </tr>
                ) : (
                  libraryReferences.map((reference) => (
                    <Fragment key={reference.isbn13}>
                      <tr
                        className={
                          openReferenceIsbn13 === reference.isbn13
                            ? "admin-reference-row-active"
                            : undefined
                        }
                        onClick={() =>
                          setOpenReferenceIsbn13((current) =>
                            current === reference.isbn13
                              ? ""
                              : reference.isbn13,
                          )
                        }
                      >
                        <td>
                          <strong>{reference.isbn13}</strong>
                        </td>
                        <td>
                          <strong>{reference.title || "제목 없음"}</strong>
                          <small>
                            {reference.contents || reference.summary || "-"}
                          </small>
                        </td>
                        <td>{reference.source}</td>
                        <td>{reference.recommendedBooks.length}</td>
                        <td>{formatDate(reference.updated_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-danger-button"
                            disabled={deletingIsbn13 === reference.isbn13}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteLibraryReference(reference);
                            }}
                          >
                            {deletingIsbn13 === reference.isbn13
                              ? "삭제 중"
                              : "삭제"}
                          </button>
                        </td>
                      </tr>
                      {openReferenceIsbn13 === reference.isbn13 && (
                        <tr className="admin-reference-raw-row">
                          <td colSpan={6}>
                            <pre>{formatJson(reference.raw)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
            <div className="admin-pagination">
              <button
                type="button"
                disabled={referencePage <= 1}
                onClick={() =>
                  setReferencePage((current) => Math.max(current - 1, 1))
                }
              >
                이전
              </button>
              <span>
                {referencePage} / {referenceTotalPages}
              </span>
              <button
                type="button"
                disabled={referencePage >= referenceTotalPages}
                onClick={() =>
                  setReferencePage((current) =>
                    Math.min(current + 1, referenceTotalPages),
                  )
                }
              >
                다음
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
