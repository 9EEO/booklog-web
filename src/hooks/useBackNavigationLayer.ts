import { useEffect, useRef } from "react";

let layerSequence = 0;
let suppressNextPop = false;
const layerStack: string[] = [];

const removeLayer = (layerId: string) => {
  const index = layerStack.indexOf(layerId);

  if (index >= 0) {
    layerStack.splice(index, 1);
  }
};

const isTopLayer = (layerId: string) =>
  layerStack[layerStack.length - 1] === layerId;

export const useBackNavigationLayer = (
  isActive: boolean,
  onClose: () => void,
  layerName: string,
) => {
  const onCloseRef = useRef(onClose);
  const closedByPopRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;

    const layerId = `${layerName}-${layerSequence}`;
    layerSequence += 1;
    closedByPopRef.current = false;
    layerStack.push(layerId);
    window.history.pushState({ booklogLayer: layerId }, "");

    const handlePopState = () => {
      if (suppressNextPop || !isTopLayer(layerId)) return;

      closedByPopRef.current = true;
      removeLayer(layerId);
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      if (closedByPopRef.current) return;

      const wasTopLayer = isTopLayer(layerId);
      removeLayer(layerId);

      if (wasTopLayer) {
        suppressNextPop = true;
        window.history.back();
        window.setTimeout(() => {
          suppressNextPop = false;
        }, 0);
      }
    };
  }, [isActive, layerName]);
};
