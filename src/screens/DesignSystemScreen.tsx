import { useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../components/Icon";
import { MiniBook } from "../components/MiniBook";
import { initialBooks } from "../data/books";

const colorTokens = [
  { name: "Canvas", variable: "--app-bg", value: "#FFF8E8" },
  { name: "Surface", variable: "--app-surface", value: "#FFFEF8" },
  { name: "Ink", variable: "--ink", value: "#151515" },
  { name: "Primary", variable: "--sage", value: "#2563EB" },
  { name: "Legacy Green", variable: "--sage-strong", value: "#76B852" },
  { name: "Highlight", variable: "--paper-deep", value: "#F2C94C" },
  { name: "Danger", variable: "--terracotta", value: "#E76F51" },
  { name: "Playful", variable: "--wood", value: "#FF7EB6" },
];

const paletteOptions = [
  {
    id: "electric-blue",
    name: "Electric Blue",
    label: "기준",
    description: "현재 앱의 파란색을 중심으로 따뜻한 코랄과 노랑을 조합한 기준안입니다.",
    colors: {
      canvas: "#F3F6FC",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#FF7A66",
      accent: "#FACC15",
      ink: "#111827",
    },
  },
  {
    id: "blue-coral",
    name: "Blue + Coral",
    label: "따뜻함",
    description: "Electric Blue의 명료함을 유지하면서 문장과 완료 상태에 따뜻함을 더합니다.",
    colors: {
      canvas: "#FFF8F6",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#F0645A",
      accent: "#FFB84D",
      ink: "#1F1B1B",
    },
  },
  {
    id: "blue-lilac",
    name: "Blue + Lilac",
    label: "차분함",
    description: "차가운 라일락 배경으로 기록 화면을 부드럽고 현대적으로 보이게 합니다.",
    colors: {
      canvas: "#F5F3FF",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#8B5CF6",
      accent: "#C4B5FD",
      ink: "#19172C",
    },
  },
  {
    id: "blue-cyan",
    name: "Blue + Cyan",
    label: "청량함",
    description: "밝고 가벼운 인상입니다. 타이머와 데이터 화면을 선명하게 보여줍니다.",
    colors: {
      canvas: "#F0F9FF",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#06B6D4",
      accent: "#67E8F9",
      ink: "#102033",
    },
  },
  {
    id: "blue-pink",
    name: "Blue + Pink",
    label: "유쾌함",
    description: "현재 픽셀 게임 요소와 잘 맞는 활기 있는 조합입니다.",
    colors: {
      canvas: "#FFF7FC",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#EC4899",
      accent: "#F9A8D4",
      ink: "#211827",
    },
  },
  {
    id: "blue-lime",
    name: "Blue + Lime",
    label: "게임성",
    description: "진행률과 달성 상태가 강하게 드러나는 디지털 게임형 조합입니다.",
    colors: {
      canvas: "#F7F9F2",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#84CC16",
      accent: "#BEF264",
      ink: "#172014",
    },
  },
  {
    id: "blue-monochrome",
    name: "Blue Monochrome",
    label: "절제",
    description: "보조색을 블루 계열로 제한해 가장 일관되고 제품 중심적으로 보입니다.",
    colors: {
      canvas: "#F4F7FC",
      surface: "#FFFFFF",
      primary: "#2563EB",
      secondary: "#60A5FA",
      accent: "#BFDBFE",
      ink: "#111827",
    },
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    label: "야간",
    description: "독서 세션이나 집중 모드에 사용할 수 있는 어두운 블루 조합입니다.",
    colors: {
      canvas: "#0F172A",
      surface: "#182338",
      primary: "#60A5FA",
      secondary: "#A78BFA",
      accent: "#FACC15",
      ink: "#F8FAFC",
    },
  },
];

const paletteColorLabels = [
  ["canvas", "Canvas"],
  ["surface", "Surface"],
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["accent", "Accent"],
  ["ink", "Ink"],
] as const;

const iconNames: IconName[] = [
  "home",
  "timer",
  "records",
  "library",
  "profile",
  "play",
  "pause",
  "stop",
  "book",
  "calendar",
  "quote",
  "camera",
  "tier",
  "check",
  "edit",
  "trash",
];

const themeDirections = [
  {
    name: "Clean Foundation",
    role: "앱 전체",
    description: "밝은 중립 배경과 Electric Blue로 콘텐츠와 행동의 위계를 명확하게 유지합니다.",
    className: "design-theme-clean",
  },
  {
    name: "Pixel Interaction",
    role: "독서 세션",
    description: "타이머와 핵심 행동에서만 단단한 테두리와 눌리는 피드백을 사용합니다.",
    className: "design-theme-pixel",
  },
  {
    name: "Editorial Moment",
    role: "문장과 기록",
    description: "인용문과 완독 기록에 제한적으로 책다운 편집 디자인을 사용합니다.",
    className: "design-theme-editorial",
  },
];

export const DesignSystemScreen = () => {
  const [progress, setProgress] = useState(46);
  const [activePaletteId, setActivePaletteId] = useState("electric-blue");
  const activePalette =
    paletteOptions.find((palette) => palette.id === activePaletteId) ??
    paletteOptions[0];
  const paletteStyle = {
    "--preview-canvas": activePalette.colors.canvas,
    "--preview-surface": activePalette.colors.surface,
    "--preview-primary": activePalette.colors.primary,
    "--preview-secondary": activePalette.colors.secondary,
    "--preview-accent": activePalette.colors.accent,
    "--preview-ink": activePalette.colors.ink,
  } as CSSProperties;

  return (
    <main className="design-system-page">
      <header className="design-system-hero">
        <div>
          <p className="design-system-eyebrow">BOOKLOG · DEV ONLY</p>
          <h1>Design System View</h1>
          <p>
            화면을 만들기 전에 여기서 시각 언어와 컴포넌트 상태를 먼저
            확인합니다.
          </p>
        </div>
        <a href="/" className="design-system-exit">
          앱으로 돌아가기
        </a>
      </header>

      <section className="design-system-direction">
        <div>
          <span>권장 방향</span>
          <h2>Clean Electric Pixel</h2>
        </div>
        <p>
          기본 화면은 차분하게, 독서 시작과 타이머 조작은 게임처럼 명확하게,
          문장 기록은 책처럼 보여줍니다.
        </p>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>01</span>
            <h2>Theme Roles</h2>
          </div>
          <p>스타일을 섞지 않고 역할별로 제한합니다.</p>
        </header>
        <div className="design-theme-grid">
          {themeDirections.map((theme) => (
            <article
              key={theme.name}
              className={`design-theme-card ${theme.className}`}
            >
              <span>{theme.role}</span>
              <h3>{theme.name}</h3>
              <p>{theme.description}</p>
              <button type="button">BUTTON SAMPLE</button>
            </article>
          ))}
        </div>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>02</span>
            <h2>Palette Lab</h2>
          </div>
          <p>하나의 Primary가 버튼, 탭, 진행률을 통일하는 방향입니다.</p>
        </header>
        <div className="design-palette-layout">
          <div className="design-palette-options">
            {paletteOptions.map((palette) => (
              <button
                key={palette.id}
                type="button"
                className={`design-palette-option ${
                  palette.id === activePalette.id
                    ? "design-palette-option-active"
                    : ""
                }`}
                onClick={() => setActivePaletteId(palette.id)}
                aria-pressed={palette.id === activePalette.id}
              >
                <span className="design-palette-swatches">
                  {Object.values(palette.colors).map((color) => (
                    <i key={color} style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="design-palette-option-copy">
                  <strong>{palette.name}</strong>
                  <small>{palette.label}</small>
                </span>
                <p>{palette.description}</p>
              </button>
            ))}
          </div>

          <article className="design-palette-preview" style={paletteStyle}>
            <header>
              <div>
                <span>TODAY</span>
                <h3>오늘도 한 장 넘겨볼까요?</h3>
              </div>
              <span className="design-palette-preview-badge">46%</span>
            </header>
            <div className="design-palette-preview-book">
              <div className="design-palette-preview-cover" />
              <div>
                <strong>작은 서점의 밤</strong>
                <span>한유진 · 134 / 288p</span>
              </div>
            </div>
            <div className="design-palette-preview-track">
              <span />
            </div>
            <button type="button">
              <Icon name="play" /> 책 펼치기
            </button>
            <nav aria-label="팔레트 미리보기 탭">
              <span><Icon name="home" />홈</span>
              <span><Icon name="records" />기록</span>
              <span><Icon name="library" />서재</span>
            </nav>
            <div className="design-palette-preview-states">
              <span className="design-palette-state-primary">
                <Icon name="check" /> 목표 달성
              </span>
              <span className="design-palette-state-secondary">문장 기록</span>
              <span className="design-palette-state-accent">NEW</span>
            </div>
          </article>
        </div>
        <div className="design-palette-token-row" style={paletteStyle}>
          {paletteColorLabels.map(([key, label]) => (
            <article key={key}>
              <span style={{ backgroundColor: activePalette.colors[key] }} />
              <div>
                <strong>{label}</strong>
                <code>{activePalette.colors[key]}</code>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>03</span>
            <h2>Color Tokens</h2>
          </div>
          <p>현재 앱에 남아 있는 레거시 토큰입니다.</p>
        </header>
        <div className="design-color-grid">
          {colorTokens.map((token) => (
            <article key={token.variable} className="design-color-card">
              <span style={{ backgroundColor: token.value }} />
              <div>
                <strong>{token.name}</strong>
                <code>{token.variable}</code>
                <small>{token.value}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>04</span>
            <h2>Typography</h2>
          </div>
          <p>Pretendard를 기본으로 사용하고 픽셀 폰트는 장식에만 사용합니다.</p>
        </header>
        <div className="design-type-specimen">
          <div>
            <span>Display · 28 / 950</span>
            <h1>오늘도 한 장 넘겨볼까요?</h1>
          </div>
          <div>
            <span>Heading · 18 / 950</span>
            <h2>오늘 책과 함께한 시간</h2>
          </div>
          <div>
            <span>Body · 13 / 750</span>
            <p>
              천천히 읽은 문장은 오래 남습니다. 본문은 편안하게 읽히는 밀도와
              행간을 유지합니다.
            </p>
          </div>
          <div className="design-type-pixel">
            <span>Pixel Accent · 10 / 400</span>
            <strong>READING QUEST · 15:00</strong>
          </div>
        </div>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>05</span>
            <h2>Actions & Inputs</h2>
          </div>
          <p>공통 상태와 터치 피드백을 비교합니다.</p>
        </header>
        <div className="design-component-grid">
          <article className="design-component-panel">
            <h3>Buttons</h3>
            <div className="design-button-stack">
              <button type="button" className="primary-button">
                <Icon name="play" /> 독서 시작
              </button>
              <button type="button" className="secondary-button">
                보조 행동
              </button>
              <button type="button" className="danger-button">
                삭제하기
              </button>
              <button type="button" className="primary-button" disabled>
                비활성 상태
              </button>
            </div>
          </article>
          <article className="design-component-panel">
            <h3>Inputs</h3>
            <label className="field-label" htmlFor="design-title">
              책 제목
            </label>
            <input
              id="design-title"
              className="pixel-input"
              defaultValue="작은 서점의 밤"
            />
            <label className="field-label design-system-label" htmlFor="design-note">
              남기고 싶은 문장
            </label>
            <textarea
              id="design-note"
              className="design-system-textarea"
              defaultValue="천천히 읽은 문장은 오래 남는다."
            />
          </article>
          <article className="design-component-panel">
            <h3>Progress</h3>
            <div className="design-progress-copy">
              <span>읽은 페이지</span>
              <strong>{progress}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
            />
            <div className="design-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="design-badge-row">
              <span className="design-badge design-badge-primary">독서중</span>
              <span className="design-badge design-badge-success">완독</span>
              <span className="design-badge design-badge-muted">1회독</span>
            </div>
          </article>
        </div>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>06</span>
            <h2>Content Cards</h2>
          </div>
          <p>실제 콘텐츠가 들어갔을 때의 밀도와 위계를 확인합니다.</p>
        </header>
        <div className="design-content-grid">
          <article className="design-book-preview">
            <span className="design-card-label">CURRENT BOOK</span>
            <MiniBook book={initialBooks[0]} />
            <div className="design-progress-track">
              <span style={{ width: "46%" }} />
            </div>
            <button type="button" className="home-start-button">
              <Icon name="play" />책 펼치기
            </button>
          </article>
          <article className="design-quote-preview">
            <Icon name="quote" />
            <blockquote>천천히 읽은 문장은 오래 남는다.</blockquote>
            <p>작은 서점의 밤 · p.42</p>
          </article>
          <article className="design-stat-preview">
            <span>이번 주 독서</span>
            <strong>3시간 24분</strong>
            <p>지난주보다 42분 더 읽었어요.</p>
          </article>
        </div>
      </section>

      <section className="design-system-section">
        <header className="design-system-section-heading">
          <div>
            <span>07</span>
            <h2>Icon Inventory</h2>
          </div>
          <p>아이콘 크기와 선명도를 한 번에 확인합니다.</p>
        </header>
        <div className="design-icon-grid">
          {iconNames.map((name) => (
            <div key={name}>
              <Icon name={name} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};
