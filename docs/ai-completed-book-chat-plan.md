# AI Completed Book Chat Plan

## Goal

Build an AI chat experience around completed books that feels technically meaningful, not like a generic chatbot bolted onto the app.

The product concept is:

> Talk with a completed book through my own reading traces.

The AI should answer from the user's reading data: completed book metadata, reading records, saved sentences, completed report, reading pattern, and tier placement. It should not pretend to know the full book text unless that text is explicitly provided.

## Why This Fits This Project

The current app already has strong raw material for an AI feature:

- Book status, current page, total pages, start date, completed date
- Reading sessions with duration, pages, date, and optional saved sentence
- Sentence OCR for capturing memorable quotes
- Completed reading report via `buildCompletedReadingReport`
- Reading pattern analysis via `buildReadingPattern`
- Completed book tier board

This means the AI feature can be framed as a service-data-based assistant rather than a simple chat UI.

## Positioning

Avoid this framing:

> Ask AI about any book.

Use this framing:

> Reflect on how I read this completed book.

The AI's job is to help the user review, interpret, and reuse their completed reading experience.

Example user questions:

- What themes did I seem to care about in this book?
- Summarize this book based on my saved sentences.
- Why might I have placed this book in S tier?
- Make a review draft from my reading records.
- Give me three discussion points for a book club.
- Compare this book with my other completed books.
- Recommend what to read next based on this completed book.

## MVP Scope

### Entry Point

Add an `AI와 회고하기` or `책과 다시 대화하기` action to the completed book detail area in `LibraryScreen`.

Recommended product label:

- Primary: `책과 다시 대화하기`
- Technical/demo label: `AI 완독 회고`

### Chat Surface

Use a bottom sheet or dedicated full-screen chat view.

The chat surface should show:

- Book title and author
- Completed date
- Total reading time
- Saved sentence count
- Tier, if available
- Recommended question chips
- Conversation messages
- Evidence cards under AI answers

### Initial Recommended Questions

Show 4-6 quick prompts:

- 이 책을 내가 어떻게 읽었는지 요약해줘
- 저장한 문장들의 공통 주제를 찾아줘
- 독서모임에서 말할 감상 포인트를 만들어줘
- 이 책을 한 문장 리뷰로 정리해줘
- 내가 이 책을 좋아한 이유를 추론해줘
- 다음에 읽을 책 방향을 추천해줘

## Technical Architecture

### 1. Server-Side AI Endpoint

Do not call the AI API directly from the browser.

Recommended options:

- `api/book-chat.js` as a Vercel API route
- `supabase/functions/book-chat/index.ts` as a Supabase Edge Function

The project already uses a Supabase function for sentence OCR, so a Supabase Edge Function would be consistent. A Vercel API route may be faster to implement if deployment and local testing are simpler.

Environment variable:

```env
OPENAI_API_KEY=...
OPENAI_BOOK_CHAT_MODEL=gpt-5.1
VITE_BOOK_CHAT_USE_MOCK=false
```

Local testing note:

- Use `vercel dev` when testing the real `/api/book-chat` route locally.
- Use `npm run dev` with `VITE_BOOK_CHAT_USE_MOCK=true` when testing only the UI flow.

### 2. Context Builder

Create a context builder that transforms app data into a compact AI-ready payload.

Suggested utility:

```ts
buildCompletedBookChatContext({
  book,
  records,
  completedReport,
  readingPattern,
  tier,
  otherCompletedBooks,
})
```

Context should include:

- Book metadata: title, author, total pages
- Stored book information: publisher, ISBN, book introduction/contents
- Reading lifecycle: started date, completed date, completed days
- Reading totals: total seconds, session count, pages read
- Reading rhythm: average session, most active weekday/time band
- Saved sentences: text, page, recorded date
- Sentence distribution: early/middle/late concentration
- Completed report highlights
- Reading pattern label and metrics
- Tier placement
- Optional comparison context from other completed books

### 3. Prompt Contract

The system prompt should enforce grounded behavior.

Core rules:

- The assistant is a completed-reading reflection partner.
- Use only the provided reading records and saved sentences as evidence.
- Do not claim to know the full book text unless full text is provided.
- If making an interpretation, label it as an interpretation.
- Prefer concrete, personal, data-backed answers.
- Return evidence and follow-up questions with every answer.
- Answer in Korean with a warm but concise tone.

### 4. Structured Response

Use structured output instead of plain text when possible.

Suggested response type:

```ts
type BookChatResponse = {
  answer: string;
  evidence: Array<{
    type: "quote" | "record" | "pattern" | "report" | "tier" | "comparison";
    label: string;
    detail: string;
  }>;
  followUpQuestions: string[];
};
```

UI should render:

- `answer` as the AI message body
- `evidence` as small cards or chips below the answer
- `followUpQuestions` as tappable prompt chips

This is important because evidence makes the feature feel more like an AI product and less like generic text generation.

## Model Strategy

### Main Chat

Use `gpt-5.1` for the main completed-book chat.

Reason:

- Better quality for personal interpretation
- Stronger reasoning over mixed context
- More reliable for nuanced Korean responses
- Better demo impact

### Lightweight Tasks

Use `gpt-5-mini` later for lower-risk helper tasks:

- Suggested question generation
- Short title generation
- Keyword extraction
- Small summaries

### Retrieval

For MVP, embeddings are optional.

If a completed book has only a moderate number of saved sentences, pass the relevant book context directly. Later, add semantic retrieval when sentence count grows.

Future retrieval model:

- `text-embedding-3-small`

Future flow:

1. Embed saved sentences.
2. Embed the user's question.
3. Retrieve the most relevant sentences.
4. Send only relevant evidence to `gpt-5.1`.
5. Display the selected evidence under the answer.

## Cost Estimate For Personal Testing

Using `gpt-5.1`, a typical completed-book chat request may look like:

- Input: 3,000-8,000 tokens for book context and conversation
- Output: 700-1,200 tokens for answer, evidence, and follow-up questions

Rough expected range:

- Light request: around $0.01
- Normal reflection request: around $0.02-$0.03
- Long context request: around $0.04-$0.05

For personal testing, this is acceptable if calls are limited and the chat is only triggered intentionally by the user.

Cost controls:

- Limit saved sentences included in full context.
- Summarize older conversation turns.
- Cache book context per completed book.
- Use `gpt-5-mini` for non-critical helper generation.
- Add request limits during development.

## Quality Controls

To avoid low-quality answers:

- Require evidence in every AI response.
- Ask the model to distinguish data-backed claims from interpretations.
- Keep the context structured, not dumped as messy prose.
- Provide strong recommended prompts so the first demo questions are high quality.
- Use `gpt-5.1` for the main chat.
- Avoid asking the model to summarize the full book unless full text is available.

Example answer standard:

> 저장한 문장들이 후반부에 몰려 있고, 완독 리포트에서도 문장 기록 피크가 후반으로 잡혀 있어요. 그래서 이 책은 초반의 정보보다 후반의 감정 변화나 결론부가 더 강하게 남은 책으로 해석할 수 있습니다.

Evidence:

- Saved sentence at 214p
- Saved sentence at 238p
- Pattern: sentence peak in late section

## Implementation Steps

### Phase 1: Local Product Demo

1. Add an AI chat entry button to completed book detail.
2. Build a chat bottom sheet component.
3. Add static/mock AI responses using real book context.
4. Render evidence cards and follow-up question chips.
5. Validate the user flow visually.

### Phase 2: Real AI Integration

1. Add server-side AI endpoint.
2. Add `OPENAI_API_KEY` to server environment.
3. Implement completed book context builder.
4. Call `gpt-5.1` with structured response.
5. Parse and display answer, evidence, and follow-up questions.
6. Add error, loading, retry, and empty-context states.

### Phase 3: Stored Book Info Expansion

1. Include stored publisher, ISBN, and book introduction in the AI context.
2. Tell the model to separate `내 기록에서 본 점`, `책 정보로 보강한 점`, and `종합 회고`.
3. Add `bookInfo` evidence cards so users can see when stored book metadata influenced the answer.
4. Keep the model from claiming live web search or full-text knowledge at this stage.

### Phase 4: Persistence

1. Add chat message storage.
2. Save user and assistant messages.
3. Store structured evidence as JSON.
4. Restore previous conversation per book.

Suggested table:

```sql
create table book_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  evidence jsonb,
  created_at timestamptz not null default now()
);
```

### Phase 5: Retrieval Upgrade

1. Add highlight embeddings table.
2. Generate embeddings for saved sentences.
3. Retrieve relevant sentences per question.
4. Use retrieved evidence in the AI prompt.
5. Add visible cited evidence to each answer.

### Phase 6: External Search Upgrade

1. Detect questions that need external information.
2. Use OpenAI Responses API with the built-in `web_search` tool only for those questions.
3. Keep answer sections separated between internal records and external information.
4. Add `external` evidence cards when web search information influences the answer.
5. Use low search context by default to keep latency and cost controlled.

Search-trigger examples:

- 저자와 책 배경을 내 기록과 연결해줘
- 이 책이 왜 유명한지 알려줘
- 비슷하게 읽을 만한 책 방향을 추천해줘
- 독서모임에서 말할 배경지식을 만들어줘

## Demo Story For Stakeholders

The stakeholder demo should emphasize that this is not a generic chatbot.

Demo flow:

1. Open a completed book.
2. Show reading history, saved sentences, and completed report.
3. Click `책과 다시 대화하기`.
4. Ask: `이 책에서 내가 중요하게 본 주제가 뭐야?`
5. Show AI answer with evidence from saved sentences and reading pattern.
6. Ask: `독서모임에서 말할 감상 포인트 3개 만들어줘`.
7. Show how the same architecture maps to another domain.

Business framing:

> This is a personal-data-based AI consultation system. In this app, the AI reads completed-book records, saved sentences, and reading patterns. In a used-car service, the same structure can read viewed cars, favorite vehicles, budget, preferred options, and consultation history to provide purchase guidance.

## Risks

- If prompts are too broad, answers may become generic.
- If book context is too thin, the AI may over-interpret.
- If the model is too cheap, the demo may feel shallow.
- If evidence is not displayed, users may not trust the answer.
- If full book knowledge is implied, hallucination risk increases.

## MVP Definition Of Done

The MVP is complete when:

- A completed book has a visible AI chat entry point.
- User can ask at least one free-form question.
- AI answer is generated from book-specific context.
- Answer includes visible evidence.
- Follow-up questions are provided.
- Empty states work for books with no saved sentences.
- API key is only used on the server.
- The feature can be explained as reusable AI consultation architecture.
