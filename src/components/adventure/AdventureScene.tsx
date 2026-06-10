import type { CSSProperties } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import adventureBackground from "../../assets/adventure-background.png";
import focusSprout from "../../assets/focus-sprout-2.gif";
import focusSproutStill from "../../assets/focus-sprout-2-still.png";

type AdventureStatus = "idle" | "running" | "paused" | "completed";

type AdventureSceneProps = {
  status: AdventureStatus;
  displayTime: string;
  progress: number;
  goalApproachProgress: number | null;
  showStartBanner: boolean;
};

type AdventureBackgroundProps = {
  isMoving: boolean;
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

const Scene = styled.section`
  position: relative;
  width: 100%;
  height: 252px;
  overflow: hidden;
  border: 2px solid #151515;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 3px 3px 0 #151515;
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

const TimerDisplay = styled.time`
  position: absolute;
  z-index: 12;
  top: 10px;
  right: 10px;
  border: 1px solid rgba(21, 21, 21, 0.2);
  border-radius: 6px;
  background: rgba(255, 254, 248, 0.92);
  box-shadow: 2px 2px 0 rgba(21, 21, 21, 0.62);
  color: #151515;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
`;

const CharacterWrap = styled.div<{ $status: AdventureStatus }>`
  position: absolute;
  z-index: 7;
  bottom: 40px;
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
  height: 10px;
  overflow: visible;
  border: 2px solid #151515;
  border-radius: 2px;
  background: #fffef8;
  box-shadow: 1px 1px 0 rgba(21, 21, 21, 0.7);
`;

const ProgressFill = styled.span`
  display: block;
  height: 100%;
  background: #2563eb;
  transition: width 280ms linear;
`;

const GoalFlag = styled.span<{ $progress: number }>`
  position: absolute;
  z-index: 6;
  bottom: 45px;
  left: ${({ $progress }) =>
    `calc(${100 - $progress * 64}% + ${-18 + $progress * 72}px)`};
  width: 3px;
  height: 29px;
  background: #151515;
  opacity: 1;
  transition:
    left 280ms linear,
    opacity 180ms ease;

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
  min-width: 38px;
  border: 1px solid rgba(21, 21, 21, 0.24);
  border-radius: 5px;
  background: rgba(255, 254, 248, 0.92);
  padding: 4px 5px;
  color: #151515;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 950;
  text-align: center;
  letter-spacing: 0;
`;

const StartBanner = styled.div`
  position: absolute;
  z-index: 20;
  top: 50%;
  left: 50%;
  border: 2px solid #151515;
  border-radius: 6px;
  background: #fffef8;
  box-shadow: 3px 3px 0 #151515;
  padding: 8px 13px;
  color: #151515;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0;
  white-space: nowrap;
  animation: ${startPanel} 1s ease both;
`;

export const AdventureBackground = ({ isMoving }: AdventureBackgroundProps) => (
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

export const AdventureScene = ({
  status,
  displayTime,
  progress,
  goalApproachProgress,
  showStartBanner,
}: AdventureSceneProps) => {
  const isMoving = status === "running";

  return (
    <Scene aria-label="독서 모험 화면">
      <AdventureBackground isMoving={isMoving} />
      <TimerDisplay>{displayTime}</TimerDisplay>
      <Character status={status} />
      {goalApproachProgress !== null && (
        <GoalFlag
          $progress={Math.min(Math.max(goalApproachProgress, 0), 1)}
          aria-hidden="true"
        />
      )}
      <ProgressBar progress={progress} />
      {showStartBanner && <StartBanner>ADVENTURE START</StartBanner>}
    </Scene>
  );
};
