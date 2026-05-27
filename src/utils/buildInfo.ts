const shortCommit = __APP_COMMIT_SHA__ === 'local' ? 'local' : __APP_COMMIT_SHA__.slice(0, 7)

const buildDate = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(__APP_BUILD_TIME__))

export const buildInfo = {
  version: __APP_VERSION__,
  commit: shortCommit,
  branch: __APP_COMMIT_REF__,
  builtAt: buildDate,
}
