# AGENTS.md

## Always

- Use feature branches for non-trivial changes.
- Use Conventional Commits for commit messages.
- Do not stage unrelated or untracked files unless explicitly requested.
- Before merge or deploy, run `npm run lint`, `npm run build`, and `git diff --check`.
- Deploy production with `npx vercel --prod`.

## Learning Notes

- When the user says `학습노트:` or `노트로 남겨줘`, append a concise note to `docs/dev-notes/YYYY-MM.md`.
- Keep notes short: question, summary, and optional next topic.
- Do not record ordinary conversation unless explicitly requested.

## Commit Types

- `feat`: new features or user-visible improvements
- `fix`: bug fixes
- `style`: visual styling or layout changes
- `refactor`: code structure changes without behavior changes
- `chore`: tooling, config, dependency, or maintenance changes
- `docs`: documentation changes

## Examples

- `feat: 로그인 화면 수정`
- `fix: 타이머 저장 요약 표시 오류 수정`
- `style: 인증 화면 간격 조정`
