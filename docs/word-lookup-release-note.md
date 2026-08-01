# 독서 중 단어/문장 기록 기능 배포 정리

배포 커밋: `a6da74a Move sentence notes into reading session`
브랜치: `main`
작성일: `2026.08.01`

## 목적

독서 타이머를 사용하는 중 모르는 단어와 기억하고 싶은 문장을 바로 기록할 수 있도록 한다. 단어는 우리말샘 검색 결과에서 뜻을 선택해 저장하고, 문장은 독서 중 직접 입력하거나 사진 OCR로 선택해 책 상세 기록에 저장한다.

저장된 단어 기록은 Supabase에 영구 동기화되어 새로고침이나 재접속 후에도 유지된다. 문장 기록은 기존 문장 저장 흐름을 재사용해 책 상세의 문장 기록에 추가된다.

## 사용자 흐름

### 단어 검색

1. 타이머 실행 중 검색 버튼을 누른다.
2. 타이머가 일시정지되고 전체 화면 단어 검색 화면이 열린다.
3. 단어를 입력하고 `GO`를 누른다.
4. 검색 결과에서 원하는 뜻을 선택한다.
5. 필요하면 단어가 나온 페이지와 문장을 입력한다.
6. 선택된 아이템의 `SAVE`를 누른다.
7. 단어 기록이 저장되고 검색 화면이 닫힌다.
8. 3초 카운트다운 후 타이머가 다시 시작된다.

### 문장 추가

1. 타이머 실행 중 `QUOTE` 버튼을 누른다.
2. 타이머가 일시정지되고 전체 화면 문장 추가 화면이 열린다.
3. 문장을 직접 입력하거나 `사진으로 담기`로 OCR 문장 선택을 사용한다.
4. 필요하면 문장이 나온 페이지를 입력한다.
5. `저장`을 누르면 책 상세의 문장 기록에 저장된다.
6. 문장 추가 화면이 닫히고 3초 카운트다운 후 타이머가 다시 시작된다.

## 포함된 기능

- 우리말샘 Open API 기반 단어 검색
- Vercel 서버 API 라우트 `/api/word-lookup` 추가
- 타이머 화면 내 전체 화면 단어 검색 UI
- 타이머 화면 내 전체 화면 문장 추가 UI
- 검색, 선택, 저장, 실패 상황에 맞춘 효과음
- 선택한 뜻 저장
- 선택 입력값 저장: 페이지, 문장
- 책 상세 페이지에서 저장된 단어 기록 조회
- 독서 중 문장 직접 입력 저장
- 독서 중 사진 OCR 기반 문장 선택 저장
- 독서 종료 화면의 `문장 남기기` 제거
- Supabase `word_notes` 테이블 기반 영구 저장
- 오프라인 저장 후 온라인 복구 시 pending sync
- 사용자별 단어 기록 보호를 위한 RLS 정책

## 주요 변경 파일

- `api/word-lookup.js`
- `src/services/wordDictionary.ts`
- `src/screens/SessionScreen.tsx`
- `src/components/adventure/AdventureScene.tsx`
- `src/screens/LibraryScreen.tsx`
- `src/services/readingSync.ts`
- `src/storage/readingStorage.ts`
- `src/types/reading.ts`
- `supabase/migrations/20260801000000_add_word_notes.sql`

## 데이터 구조

Supabase에 `word_notes` 테이블을 추가했다.

주요 컬럼:

- `user_id`: 사용자 소유자
- `book_id`: 단어가 저장된 책
- `word`: 저장한 단어
- `definition`: 선택한 뜻
- `page`: 단어가 나온 페이지, 선택 입력
- `context_sentence`: 단어가 나온 문장, 선택 입력
- `recorded_at`: 저장일
- `source`, `source_name`, `source_url`: 사전 출처 정보
- `license`: 출처 라이선스 정보
- `pos`, `category`, `origin`: 품사, 분류, 어원 메타데이터

## 배포 전 완료된 작업

- Supabase 원격 DB에 `20260801000000_add_word_notes.sql` 마이그레이션 적용 완료
- `main` 브랜치에 기능 커밋 머지 완료
- GitHub `origin/main` 푸시 완료
- 독서 중 문장 추가 기능 커밋 적용 완료: `a6da74a`
- `npm run lint` 통과
- `npm run build` 통과

## 배포 환경변수

배포 환경에는 아래 환경변수가 필요하다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WOORIMALSAEM_API_KEY`

`WOORIMALSAEM_API_KEY`는 서버 API에서만 사용하므로 `VITE_` 접두사를 붙이지 않는다.

## 배포 후 확인 항목

- 타이머 실행 중 검색 버튼이 표시되는지 확인한다.
- 검색 버튼을 누르면 타이머가 일시정지되는지 확인한다.
- 단어 검색 결과가 정상 표시되는지 확인한다.
- 결과 아이템 선택 후 페이지와 문장을 입력할 수 있는지 확인한다.
- `SAVE` 후 검색 화면이 닫히고 3초 카운트다운 후 타이머가 재개되는지 확인한다.
- 책 상세 페이지에서 저장된 단어, 뜻, 페이지, 문장이 표시되는지 확인한다.
- 타이머 실행 중 `QUOTE` 버튼이 표시되는지 확인한다.
- `QUOTE` 버튼을 누르면 타이머가 일시정지되고 문장 추가 화면이 열리는지 확인한다.
- 문장을 직접 입력해 저장하면 책 상세의 문장 기록에 표시되는지 확인한다.
- 사진 OCR로 선택한 문장을 저장할 수 있는지 확인한다.
- 문장 저장 또는 닫기 후 3초 카운트다운 뒤 타이머가 재개되는지 확인한다.
- 독서 종료 화면에서 `문장 남기기` 버튼이 제거되었는지 확인한다.
- 새로고침 후에도 단어 기록이 유지되는지 확인한다.
- 오프라인 상태에서 저장한 단어가 온라인 복구 후 Supabase에 동기화되는지 확인한다.

## 남은 개선 항목

- 단어 저장 시 타이머 캐릭터에 애니메이션 피드백 추가
