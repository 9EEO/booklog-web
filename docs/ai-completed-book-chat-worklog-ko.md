# AI 완독 책 챗봇 작업 기록

작성일: 2026-07-30

## 목표

완독한 책을 기준으로 사용자가 AI와 대화할 수 있는 기능을 구현했다.

초기 목표는 단순한 챗봇이 아니라, 다음 데이터를 함께 활용하는 AI 회고 경험을 만드는 것이었다.

- 사용자의 완독 기록
- 독서 시간과 페이지 진행 기록
- 저장한 문장
- 완독 리포트
- 독서 패턴
- 티어 정보
- 저장된 책 메타데이터
- 필요 시 외부 검색 정보

핵심 포지셔닝은 다음과 같다.

> 완독한 책과 다시 대화하기

## 현재 구현 상태

현재 앱에서는 완독 책 상세 화면에서 `책과 다시 대화하기` 기능을 사용할 수 있다.

사용자는 추천 질문을 누르거나 직접 질문을 입력할 수 있고, AI는 답변과 함께 근거 카드, 후속 질문을 반환한다.

답변은 다음과 같은 구조를 지향한다.

- 내 기록에서 본 점
- 책 정보/외부 정보로 보강한 점
- 종합 회고

## 주요 구현 파일

### `src/types/bookChat.ts`

AI 채팅에 필요한 타입을 추가했다.

주요 타입:

- `BookChatMessage`
- `BookChatResponse`
- `BookChatEvidence`
- `CompletedBookChatContext`

근거 타입은 현재 다음 값을 지원한다.

- `bookInfo`
- `external`
- `quote`
- `record`
- `pattern`
- `report`
- `tier`
- `comparison`

### `src/utils/completedBookChatContext.ts`

완독 책 데이터를 AI에게 넘길 수 있는 구조로 정리하는 컨텍스트 빌더를 추가했다.

포함되는 정보:

- 책 제목, 저자, 총 페이지
- 출판사, ISBN, 책 소개글
- 시작일, 완독일, 완독 기간
- 총 독서 시간, 기록 수, 읽은 페이지
- 평균 세션, 페이지 속도, 주요 요일/시간대
- 저장 문장과 문장이 위치한 구간
- 완독 리포트 요약
- 독서 패턴
- 티어 정보
- 다른 완독 책 비교용 요약

### `src/services/bookChat.ts`

프론트엔드에서 AI 서버 API를 호출하는 서비스 계층을 추가했다.

현재 기본 동작은 `/api/book-chat` 호출이다.

다만 `.env.local`에 아래 값이 있으면 mock 응답을 사용한다.

```env
VITE_BOOK_CHAT_USE_MOCK=true
```

mock 응답은 실제 API 없이 UI 흐름을 확인할 때 사용할 수 있다.

### `api/book-chat.js`

OpenAI API를 호출하는 서버 API route를 추가했다.

브라우저에 API 키가 노출되지 않도록, OpenAI 호출은 이 서버 route에서만 수행한다.

현재 동작 방식:

1. 질문과 완독 책 컨텍스트를 받는다.
2. 질문이 외부 지식을 요구하는지 판단한다.
3. 외부 정보가 필요 없으면 Chat Completions API로 구조화 답변을 생성한다.
4. 외부 정보가 필요하면 Responses API의 `web_search` 도구로 먼저 검색 요약을 만든다.
5. 검색 요약과 사용자 기록을 함께 넣어 Chat Completions API로 최종 구조화 답변을 생성한다.
6. 답변, 근거 카드, 후속 질문을 JSON으로 반환한다.

### `vite.config.ts`

Vite dev 서버에서도 `/api/book-chat`을 사용할 수 있도록 dev middleware를 추가했다.

이제 로컬에서 `vercel dev`가 없어도 아래 명령만으로 실제 AI 대화 테스트가 가능하다.

```bash
npm run dev
```

미들웨어에서 하는 일:

- `.env.local` 로딩
- JSON request body 파싱
- Vercel API route 스타일의 `response.status().json()` 어댑터 제공
- `api/book-chat.js` 핸들러 재사용

### `api/book-chat.d.ts`

`vite.config.ts`에서 JS API route를 import할 때 TypeScript 타입 오류가 나지 않도록 선언 파일을 추가했다.

### `src/screens/LibraryScreen.tsx`

완독 책 상세 화면에 AI 회고 UI를 연결했다.

추가된 UI:

- `책과 다시 대화하기` 카드
- AI 채팅 바텀시트
- 추천 질문 버튼
- 사용자/AI 메시지
- 근거 카드
- 후속 질문 버튼
- 로딩 상태
- 에러 메시지

현재 추천 질문:

- 이 책을 내가 어떻게 읽었는지 요약해줘
- 저자와 책 배경을 내 기록과 연결해줘
- 저장한 문장들의 공통 주제를 찾아줘
- 독서모임에서 말할 감상 포인트를 만들어줘
- 이 책을 한 문장 리뷰로 정리해줘
- 비슷하게 읽을 만한 책 방향을 추천해줘

### `src/index.css`

AI 회고 카드, 채팅 바텀시트, 근거 카드, 에러 메시지 스타일을 추가했다.

근거 타입별 카드 색상도 구분했다.

- 책 정보: `bookInfo`
- 외부 검색: `external`
- 저장 문장: `quote`
- 독서 기록: `record`
- 독서 패턴: `pattern`
- 완독 리포트: `report`
- 티어: `tier`
- 비교 정보: `comparison`

## 환경변수

`.env.local`에 다음 값이 필요하다.

```env
OPENAI_API_KEY=발급받은_OpenAI_API_KEY
OPENAI_BOOK_CHAT_MODEL=gpt-5.1
VITE_BOOK_CHAT_USE_MOCK=false
```

주의:

- `OPENAI_API_KEY`는 절대 `VITE_` 접두어를 붙이면 안 된다.
- `VITE_` 접두어가 붙은 환경변수는 브라우저 번들에 노출될 수 있다.
- 현재 API 키는 서버 route에서만 사용한다.

## OpenAI 연동 방식

### 기본 답변

외부 검색이 필요 없는 질문은 Chat Completions API로 바로 답변한다.

예:

- 내가 이 책을 어떻게 읽었는지 요약해줘
- 내 저장 문장들의 공통점 알려줘
- 내 독서 패턴을 분석해줘

### 외부 검색 답변

외부 정보가 필요하다고 판단되는 질문은 2단계로 처리한다.

1. Responses API + `web_search`로 책/저자/배경 정보를 검색한다.
2. 검색 요약을 내부 기록 컨텍스트와 함께 Chat Completions API에 넣어 최종 답변을 구조화한다.

외부 검색이 트리거되는 대표 질문:

- 저자와 책 배경을 내 기록과 연결해줘
- 이 책이 왜 유명한지 알려줘
- 비슷하게 읽을 만한 책 방향을 추천해줘
- 독서모임에서 말할 배경지식을 만들어줘
- 책 정보와 내 기록을 연결해서 설명해줘

## 답변 형식

서버는 AI에게 다음 JSON 구조를 요구한다.

```ts
type BookChatResponse = {
  answer: string;
  evidence: Array<{
    type:
      | "bookInfo"
      | "external"
      | "quote"
      | "record"
      | "pattern"
      | "report"
      | "tier"
      | "comparison";
    label: string;
    detail: string;
  }>;
  followUpQuestions: string[];
};
```

UI에서는 다음처럼 렌더링한다.

- `answer`: AI 답변 본문
- `evidence`: 근거 카드
- `followUpQuestions`: 이어 묻기 버튼

## 실제 테스트 결과

다음 검증을 완료했다.

```bash
npm run build
npm run lint
```

결과:

- build 통과
- lint 통과
- Vite 번들 경고는 존재하지만 기존 chunk size 경고이며 기능 오류는 아님

실제 API 테스트도 진행했다.

확인된 내용:

- `OPENAI_API_KEY`가 서버에서 정상 로딩됨
- OpenAI API 호출 성공
- `gpt-5.1` 응답 성공
- 구조화 JSON 응답 성공
- Vite dev middleware의 `/api/book-chat` 호출 성공
- 외부 검색 트리거 질문에서 `external` 근거 타입 포함 확인

테스트한 대표 질문:

```txt
저자와 책 배경을 내 기록과 연결해줘
```

응답에서 확인된 근거 타입 예:

```txt
record
quote
report
pattern
external
```

## 구현 중 발견한 이슈와 해결

### 1. API quota 문제

초기 OpenAI 호출 시 `429 quota exceeded`가 발생했다.

원인:

- OpenAI 계정의 결제/크레딧/사용 한도 문제

해결:

- 요금 충전 후 재테스트
- 서버 route에서 429 에러를 한국어 안내로 매핑

### 2. `npm run dev`에서 `/api` 미동작

Vercel CLI가 설치되어 있지 않아 로컬에서 `/api/book-chat`을 바로 테스트하기 어려웠다.

해결:

- Vite dev middleware 추가
- 이제 `npm run dev`만으로 `/api/book-chat` 테스트 가능

### 3. web search와 structured output 직접 결합 문제

Responses API에서 web search와 JSON mode/structured output을 직접 결합했을 때 제약이 있었다.

해결:

- 1차 호출: Responses API + web search로 외부 검색 요약 생성
- 2차 호출: Chat Completions API + JSON schema로 최종 구조화 답변 생성

### 4. 최종 JSON 응답 잘림

외부 검색 요약을 넣은 뒤 답변이 길어져 `finish_reason: length`가 발생하고 JSON 파싱이 깨졌다.

해결:

- 프롬프트에 `answer는 900자 이내` 규칙 추가
- `max_completion_tokens`를 3200으로 증가
- 컨텍스트에 없는 사용자 개인 상황을 상상하지 말라는 규칙 추가

## 현재 한계

아직 남아 있는 한계는 다음과 같다.

- 외부 검색이 항상 완벽한 출처 URL을 제공하지 않을 수 있다.
- 검색 결과 요약과 최종 답변 생성이 2번 호출되므로 비용과 응답 시간이 증가한다.
- 질문 유형 판별은 현재 키워드 기반이다.
- 대화 기록은 아직 DB에 저장하지 않는다.
- 저장 문장이 매우 많아질 경우 컨텍스트가 커질 수 있다.
- 외부 검색 결과의 출처 표시 UI는 아직 단순한 근거 카드 수준이다.

## 비용 관점

현재 비용은 질문 유형에 따라 달라진다.

내 기록만 쓰는 질문:

- OpenAI 호출 1회
- 상대적으로 저렴하고 빠름

외부 검색이 필요한 질문:

- web search 포함 Responses API 호출 1회
- 최종 구조화 답변용 Chat Completions 호출 1회
- 비용과 응답 시간이 더 큼

따라서 외부 검색은 모든 질문에 켜지 않고, 필요한 질문에서만 조건부로 켜는 구조로 구현했다.

## 다음 작업 후보

### 1. 외부 검색 여부 표시

채팅 UI 상단이나 답변 카드에 다음 같은 표시를 추가할 수 있다.

```txt
외부 정보 사용됨
```

### 2. 검색 모드 토글

사용자가 직접 답변 기준을 고를 수 있게 만들 수 있다.

```txt
답변 기준: 내 기록만 / 책 정보 포함 / 외부 검색 포함
```

### 3. 대화 저장

Supabase에 책별 AI 대화 기록을 저장할 수 있다.

예상 테이블:

```sql
book_chat_messages
```

저장 항목:

- user_id
- book_id
- role
- content
- evidence
- created_at

### 4. 저장 문장 RAG

저장 문장이 많아질 경우 모든 문장을 매번 보내지 않고, 질문과 관련 있는 문장만 검색해서 넘기는 구조가 필요하다.

후보:

- `text-embedding-3-small`
- Supabase pgvector

### 5. 외부 출처 품질 개선

외부 검색 결과를 더 잘 보여주기 위해 다음을 개선할 수 있다.

- 출처 URL 카드화
- 출처 제목 표시
- 외부 검색 요약 별도 표시
- 신뢰할 만한 도메인 우선

## 현재 사용 방법

로컬 실행:

```bash
npm run dev
```

사용 흐름:

1. 앱 접속
2. 서재로 이동
3. 완독 책 선택
4. `책과 다시 대화하기` 클릭
5. 추천 질문 클릭 또는 직접 질문 입력

외부 검색까지 테스트하기 좋은 질문:

```txt
저자와 책 배경을 내 기록과 연결해줘
```

```txt
이 책이 왜 유명한지 내 저장 문장과 연결해서 설명해줘
```

```txt
비슷하게 읽을 만한 책 방향을 추천해줘
```

내 기록만 테스트하기 좋은 질문:

```txt
이 책을 내가 어떻게 읽었는지 요약해줘
```

```txt
저장한 문장들의 공통 주제를 찾아줘
```

```txt
내 독서 패턴을 분석해줘
```
