import { useEffect, useRef, useState, type CSSProperties } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import adventureBackground from "../../assets/adventure-background.png";
import focusSprout from "../../assets/focus-sprout-2.gif";
import focusSproutStill from "../../assets/focus-sprout-2-still.png";
import { Icon } from "../Icon";

type AdventureStatus = "idle" | "running" | "paused" | "completed";
type AdventureMode = "countdown" | "stopwatch";

type AdventurePreset = {
  label: string;
  seconds: number;
};

type MemoryLog = {
  id: string;
  text: string;
  bookTitle: string;
  page: number;
};

type AdventureSceneProps = {
  status: AdventureStatus;
  mode: AdventureMode;
  displayTime: string;
  progress: number;
  goalApproachProgress: number | null;
  showStartBanner: boolean;
  presets: AdventurePreset[];
  targetSeconds: number;
  memoryLogs: MemoryLog[];
  memorySeed: string;
  onChangeMode: (mode: AdventureMode) => void;
  onSelectPreset: (seconds: number) => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
};

const scrollBackground = keyframes`
  from { background-position-x: 0; }
  to { background-position-x: -637px; }
`;

const bounceWalk = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-1deg); }
  50% { transform: translate3d(0, -5px, 0) rotate(1deg); }
`;

const celebrate = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  35% { transform: translate3d(0, -11px, 0) scale(1.06); }
  60% { transform: translate3d(0, -4px, 0) scale(0.98); }
`;

const startPanel = keyframes`
  0% { opacity: 0; transform: translate3d(-50%, 8px, 0) scale(0.96); }
  18%, 72% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(-50%, -5px, 0) scale(0.98); }
`;

const countdownPulse = keyframes`
  0% { opacity: 0; transform: scale(1.45); }
  20%, 72% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.82); }
`;

const scrollMemoryQuote = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(-50%); }
`;

const Scene = styled.section`
  position: relative;
  width: 100%;
  height: 320px;
  overflow: hidden;
  border: 2px solid #151515;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 2px 2px 0 #151515;
  isolation: isolate;
`;

const MovingBackground = styled.div<{ $isMoving: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 1;
  background-color: #ffffff;
  background-image: url(${adventureBackground});
  background-repeat: repeat-x;
  background-size: 637px 318px;
  background-position: 0 0;
  animation: ${scrollBackground} 24s linear infinite;
  animation-play-state: ${({ $isMoving }) =>
    $isMoving ? "running" : "paused"};
  image-rendering: pixelated;
  will-change: background-position;
`;

const PixelPanel = styled.div`
  border: 2px solid #151515;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.95);
`;

const PrepOverlay = styled.div`
  position: absolute;
  z-index: 18;
  inset: 8px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 8px;
  font-family: var(--font-pixel);
`;

const MissionSelect = styled(PixelPanel)`
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 9px;
`;

const MenuLabel = styled.p`
  color: rgba(21, 21, 21, 0.5);
  font-size: 8px;
  font-weight: 950;
  letter-spacing: 1px;
`;

const MissionList = styled.div`
  display: grid;
  align-content: center;
  gap: 6px;
  margin-top: 8px;
`;

const MissionButton = styled.button<{ $active: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border: 2px solid
    ${({ $active }) => ($active ? "#151515" : "rgba(21, 21, 21, 0.2)")};
  border-radius: 2px;
  background: ${({ $active }) =>
    $active ? "#151515" : "rgba(255, 255, 255, 0.92)"};
  color: ${({ $active }) => ($active ? "#ffffff" : "#151515")};
  padding: 5px 10px;
  font-family: var(--font-pixel);
  text-align: left;

  &:active {
    transform: translateY(1px);
  }

  svg {
    width: 11px;
    height: 11px;
    opacity: ${({ $active }) => ($active ? 1 : 0.28)};
    color: ${({ $active }) => ($active ? "#f2c94c" : "#151515")};
  }

  strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 950;
    letter-spacing: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    justify-self: end;
    color: ${({ $active }) =>
      $active ? "rgba(255, 255, 255, 0.7)" : "rgba(21, 21, 21, 0.5)"};
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 0.5px;
  }
`;

const StartButton = styled.button`
  min-height: 38px;
  border: 2px solid #151515;
  border-radius: 2px;
  background: #151515;
  color: #f2c94c;
  font-family: var(--font-pixel);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0;

  &:active {
    background: #2b2b2b;
    transform: translateY(1px);
  }
`;

const MemoryOverlay = styled.div`
  position: absolute;
  z-index: 18;
  inset: 8px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 8px;
  font-family: var(--font-pixel);
`;

const MemoryPanel = styled(PixelPanel)`
  display: grid;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  padding: 15px;
`;

const MemoryQuote = styled.blockquote<{ $isLong: boolean; $duration: number }>`
  display: grid;
  min-height: 0;
  align-items: ${({ $isLong }) => ($isLong ? "start" : "center")};
  overflow: hidden;
  padding: 10px 5px;
  color: #151515;
  font-family: var(--font-pixel);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: -0.2px;
  line-height: 2;
  text-align: center;

  > div {
    display: grid;
    gap: 28px;
    animation: ${({ $isLong }) => ($isLong ? scrollMemoryQuote : "none")}
      ${({ $duration }) => $duration}s linear infinite;
    will-change: transform;
  }

  blockquote {
    padding: 8px 0;
  }

  blockquote[aria-hidden="true"] {
    display: ${({ $isLong }) => ($isLong ? "block" : "none")};
  }

  @media (prefers-reduced-motion: reduce) {
    overflow-y: auto;

    > div {
      animation: none;
    }

    blockquote[aria-hidden="true"] {
      display: none;
    }
  }
`;

const MemorySource = styled.p`
  margin-top: 14px;
  color: rgba(21, 21, 21, 0.5);
  font-family: var(--font-pixel);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.3px;
  text-align: center;
`;

const MemoryActions = styled.div`
  display: block;
`;

const MemoryButton = styled.button<{ $primary?: boolean }>`
  width: 100%;
  min-height: 38px;
  border: 2px solid #151515;
  border-radius: 2px;
  background: ${({ $primary }) => ($primary ? "#151515" : "#ffffff")};
  color: ${({ $primary }) => ($primary ? "#f2c94c" : "#151515")};
  font-family: var(--font-pixel);
  font-size: 10px;
  font-weight: 950;

  &:active {
    transform: translateY(1px);
  }
`;

const SetupBackButton = styled.button`
  justify-self: start;
  border: 0;
  background: transparent;
  color: rgba(21, 21, 21, 0.5);
  padding: 0;
  font-family: var(--font-pixel);
  font-size: 7px;
  font-weight: 950;
`;

const ActionDock = styled.div`
  position: absolute;
  z-index: 14;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 4px;
`;

const SceneHud = styled.time`
  position: absolute;
  z-index: 14;
  top: 9px;
  right: 11px;
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  color: #151515;
  font-family: var(--font-pixel);
  font-size: 12px;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9),
    0 -1px 0 rgba(255, 255, 255, 0.6),
    1px 0 0 rgba(255, 255, 255, 0.6),
    -1px 0 0 rgba(255, 255, 255, 0.6);
`;

const SceneHudStatus = styled.span`
  color: rgba(21, 21, 21, 0.5);
  font-size: 7px;
  font-weight: 950;
  letter-spacing: 0.5px;
`;

const ActionButton = styled.button<{ $danger?: boolean }>`
  min-height: 22px;
  border: 2px solid #151515;
  border-radius: 2px;
  background: ${({ $danger }) =>
    $danger ? "rgba(255, 255, 255, 0.9)" : "#151515"};
  color: ${({ $danger }) => ($danger ? "#151515" : "#f2c94c")};
  padding: 0 6px;
  font-family: var(--font-pixel);
  font-size: 7px;
  font-weight: 950;
  letter-spacing: 0;

  &:active {
    opacity: 0.68;
  }
`;

const CharacterWrap = styled.div<{ $status: AdventureStatus }>`
  position: absolute;
  z-index: 7;
  bottom: 108px;
  left: 36%;
  width: 50px;
  height: 43px;
  animation: ${({ $status }) =>
      $status === "running"
        ? bounceWalk
        : $status === "completed"
          ? celebrate
          : "none"}
    ${({ $status }) => ($status === "completed" ? "700ms" : "560ms")}
    ease-in-out infinite;
  animation-play-state: ${({ $status }) =>
    $status === "paused" ? "paused" : "running"};
  transform-origin: center bottom;
  will-change: transform;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 61%;
    image-rendering: pixelated;
  }
`;

const ProgressDock = styled.div`
  position: absolute;
  z-index: 14;
  right: 10px;
  bottom: 8px;
  left: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
`;

const ProgressTrack = styled.div`
  position: relative;
  height: 8px;
  overflow: hidden;
  border: 2px solid #151515;
  border-radius: 1px;
  background: #ffffff;
`;

const ProgressFill = styled.span`
  display: block;
  height: 100%;
  background: #151515;
  transition: width 280ms linear;
`;

const GoalFlag = styled.span<{ $progress: number }>`
  position: absolute;
  z-index: 6;
  bottom: 113px;
  left: ${({ $progress }) =>
    `calc(${100 - $progress * 64}% + ${-18 + $progress * 72}px)`};
  width: 3px;
  height: 29px;
  background: #151515;
  transition: left 280ms linear;

  &::before {
    position: absolute;
    top: 0;
    left: 3px;
    width: 16px;
    height: 10px;
    background: #f2c94c;
    clip-path: polygon(0 0, 100% 0, 75% 100%, 0 100%);
    content: "";
  }
`;

const ProgressLabel = styled.span`
  min-width: 34px;
  color: #151515;
  font-family: var(--font-pixel);
  font-size: 8px;
  font-weight: 950;
  text-align: right;
  letter-spacing: 0;
`;

const StartBanner = styled.div`
  position: absolute;
  z-index: 20;
  top: 50%;
  left: 50%;
  border: 2px solid #151515;
  border-radius: 2px;
  background: #ffffff;
  padding: 8px 13px;
  color: #151515;
  font-family: var(--font-pixel);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0;
  white-space: nowrap;
  animation: ${startPanel} 1s ease both;
`;

const CountdownOverlay = styled.div`
  position: absolute;
  z-index: 30;
  inset: 8px;
  display: grid;
  place-items: center;
  border: 2px solid #151515;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.88);
  color: #151515;
  font-family: var(--font-pixel);

  strong {
    font-size: 48px;
    font-weight: 950;
    text-shadow: 3px 3px 0 #f2c94c;
    animation: ${countdownPulse} 1s steps(4, end) both;
  }
`;

export const AdventureBackground = ({ isMoving }: { isMoving: boolean }) => (
  <MovingBackground $isMoving={isMoving} />
);

export const Character = ({ status }: { status: AdventureStatus }) => (
  <CharacterWrap $status={status}>
    <img src={status === "running" ? focusSprout : focusSproutStill} alt="" />
  </CharacterWrap>
);

export const ProgressBar = ({ progress }: { progress: number }) => {
  const safeProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <ProgressDock>
      <ProgressTrack>
        <ProgressFill style={{ width: `${safeProgress}%` } as CSSProperties} />
      </ProgressTrack>
      <ProgressLabel>{Math.round(safeProgress)}%</ProgressLabel>
    </ProgressDock>
  );
};

export const AdventurePrepare = ({
  showBack,
  mode,
  presets,
  targetSeconds,
  onChangeMode,
  onSelectPreset,
  onBack,
  onStart,
}: Pick<
  AdventureSceneProps,
  | "mode"
  | "presets"
  | "targetSeconds"
  | "onChangeMode"
  | "onSelectPreset"
  | "onStart"
> & {
  showBack: boolean;
  onBack: () => void;
}) => {
  const stages = presets.filter((preset) => preset.seconds >= 60);
  const isFreeJourney = mode === "stopwatch";

  return (
    <PrepOverlay>
      <MissionSelect>
        {showBack ? (
          <SetupBackButton type="button" onClick={onBack}>
            ← MEMORY LOG
          </SetupBackButton>
        ) : (
          <MenuLabel>MISSION SELECT</MenuLabel>
        )}
        <MissionList>
          {stages.map((preset, index) => {
            const isActive =
              mode === "countdown" && targetSeconds === preset.seconds;

            return (
              <MissionButton
                key={preset.seconds}
                type="button"
                $active={isActive}
                onClick={() => onSelectPreset(preset.seconds)}
              >
                <Icon name="chevronRight" />
                <strong style={{ fontSize: "0.53em" }}>{preset.label}</strong>
                <span>STAGE {index + 1}</span>
              </MissionButton>
            );
          })}
          <MissionButton
            type="button"
            $active={isFreeJourney}
            onClick={() => onChangeMode("stopwatch")}
          >
            <Icon name="chevronRight" />
            <strong style={{ fontSize: "0.53em" }}>FREE JOURNEY</strong>
            <span>STOPWATCH</span>
          </MissionButton>
        </MissionList>
      </MissionSelect>

      <StartButton type="button" onClick={onStart}>
        START ADVENTURE
      </StartButton>
    </PrepOverlay>
  );
};

const getMemorySeed = (value: string) =>
  Array.from(value).reduce(
    (seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

export const AdventureScene = ({
  status,
  mode,
  displayTime,
  progress,
  goalApproachProgress,
  showStartBanner,
  presets,
  targetSeconds,
  memoryLogs,
  memorySeed,
  onChangeMode,
  onSelectPreset,
  onStart,
  onPause,
  onStop,
}: AdventureSceneProps) => {
  const [isTimeSettingOpen, setIsTimeSettingOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimersRef = useRef<number[]>([]);
  const isPreparing = status === "idle";
  const isCountdownActive = countdown !== null;
  const isMoving = status === "running";
  const memoryLog =
    memoryLogs[getMemorySeed(memorySeed) % Math.max(memoryLogs.length, 1)];
  const isLongMemory = Boolean(memoryLog && memoryLog.text.length > 105);
  const memoryScrollDuration = memoryLog
    ? Math.min(Math.max(Math.round(memoryLog.text.length / 8), 14), 42)
    : 14;
  const showMemoryLog =
    isPreparing && memoryLogs.length > 0 && !isTimeSettingOpen;
  const hudStatusLabel =
    status === "paused" ? "PAUSED" : status === "completed" ? "CLEAR" : "";

  useEffect(
    () => () => {
      countdownTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
    },
    [],
  );

  const startCountdown = () => {
    if (countdown !== null) return;

    countdownTimersRef.current.forEach((timerId) =>
      window.clearTimeout(timerId),
    );
    setCountdown(3);
    countdownTimersRef.current = [
      window.setTimeout(() => setCountdown(2), 1000),
      window.setTimeout(() => setCountdown(1), 2000),
      window.setTimeout(() => {
        setCountdown(null);
        setIsTimeSettingOpen(false);
        onStart();
      }, 3000),
    ];
  };

  return (
    <Scene aria-label="독서 모험 화면">
      <AdventureBackground isMoving={isMoving} />

      {isCountdownActive ? (
        <>
          <SceneHud aria-live="polite">{displayTime}</SceneHud>
          <Character status="idle" />
          <ProgressBar progress={progress} />
        </>
      ) : showMemoryLog && memoryLog ? (
        <MemoryOverlay>
          <MemoryPanel>
            <MemoryQuote
              key={memoryLog.id}
              $isLong={isLongMemory}
              $duration={memoryScrollDuration}
            >
              <div>
                <blockquote>
                  <p>“{memoryLog.text}”</p>
                  <MemorySource>
                    {memoryLog.bookTitle} · {memoryLog.page}p
                  </MemorySource>
                </blockquote>
                <blockquote aria-hidden="true">
                  <p>“{memoryLog.text}”</p>
                  <MemorySource>
                    {memoryLog.bookTitle} · {memoryLog.page}p
                  </MemorySource>
                </blockquote>
              </div>
            </MemoryQuote>
          </MemoryPanel>
          <MemoryActions>
            <MemoryButton
              type="button"
              $primary
              onClick={() => {
                setIsTimeSettingOpen(true);
              }}
            >
              시간 설정
            </MemoryButton>
          </MemoryActions>
        </MemoryOverlay>
      ) : isPreparing ? (
        <AdventurePrepare
          showBack={memoryLogs.length > 0}
          mode={mode}
          presets={presets}
          targetSeconds={targetSeconds}
          onChangeMode={onChangeMode}
          onSelectPreset={onSelectPreset}
          onBack={() => {
            setIsTimeSettingOpen(false);
          }}
          onStart={startCountdown}
        />
      ) : (
        <>
          {(status === "running" || status === "paused") && (
            <ActionDock>
              <ActionButton
                type="button"
                onClick={status === "running" ? onPause : onStart}
              >
                {status === "running" ? "PAUSE" : "RESUME"}
              </ActionButton>
              <ActionButton type="button" $danger onClick={onStop}>
                STOP
              </ActionButton>
            </ActionDock>
          )}
          <SceneHud aria-live="polite">
            {hudStatusLabel && (
              <SceneHudStatus>{hudStatusLabel} ·</SceneHudStatus>
            )}
            {displayTime}
          </SceneHud>
          <Character status={status} />
          {goalApproachProgress !== null && (
            <GoalFlag
              $progress={Math.min(Math.max(goalApproachProgress, 0), 1)}
              aria-hidden="true"
            />
          )}
          <ProgressBar progress={progress} />
          {showStartBanner && <StartBanner>ADVENTURE START</StartBanner>}
        </>
      )}
      {isCountdownActive && (
        <CountdownOverlay aria-live="assertive">
          <strong key={countdown}>{countdown}</strong>
        </CountdownOverlay>
      )}
    </Scene>
  );
};
