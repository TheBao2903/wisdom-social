import { useState, useCallback } from "react";

export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  backgroundColor: string;
  bgOpacity: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase" | "lowercase";
  align: "left" | "center" | "right";
  textShadow: boolean;
  zIndex: number;
}

let nextId = 1;

const FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Playfair Display",
  "Montserrat",
  "Dancing Script",
  "Bebas Neue",
  "Oswald",
  "Pacifico",
  "Lobster",
  "Poppins",
];

const DEFAULT_LAYER: Omit<TextLayer, "id" | "zIndex"> = {
  text: "",
  x: 50,
  y: 50,
  rotation: 0,
  scale: 1,
  color: "#ffffff",
  backgroundColor: "transparent",
  bgOpacity: 0,
  fontSize: 28,
  fontFamily: "Inter",
  fontWeight: "normal",
  fontStyle: "normal",
  textTransform: "none",
  align: "center",
  textShadow: true,
};

export function useStoryTextManager() {
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  const addLayer = useCallback(() => {
    const id = `text_${nextId++}_${Date.now()}`;
    const newLayer: TextLayer = {
      ...DEFAULT_LAYER,
      id,
      zIndex: layers.length + 1,
      y: 40 + Math.random() * 20,
      x: 30 + Math.random() * 40,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(id);
    setEditingId(id);
    return id;
  }, [layers.length]);

  const updateLayer = useCallback((id: string, updates: Partial<TextLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  }, []);

  const removeLayer = useCallback(
    (id: string) => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setEditingId(null);
      }
    },
    [selectedId]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      const newId = `text_${nextId++}_${Date.now()}`;
      const newLayer: TextLayer = {
        ...layer,
        id: newId,
        x: layer.x + 3,
        y: layer.y + 3,
        zIndex: layers.length + 1,
      };
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newId);
    },
    [layers]
  );

  const bringForward = useCallback(
    (id: string) => {
      setLayers((prev) => {
        const maxZ = Math.max(...prev.map((l) => l.zIndex));
        return prev.map((l) =>
          l.id === id ? { ...l, zIndex: maxZ + 1 } : l
        );
      });
    },
    []
  );

  const sendBackward = useCallback(
    (id: string) => {
      setLayers((prev) => {
        const minZ = Math.min(...prev.map((l) => l.zIndex));
        return prev.map((l) =>
          l.id === id ? { ...l, zIndex: Math.max(0, minZ - 1) } : l
        );
      });
    },
    []
  );

  const deselectAll = useCallback(() => {
    setSelectedId(null);
    setEditingId(null);
  }, []);

  return {
    layers,
    selectedId,
    editingId,
    selectedLayer,
    setSelectedId,
    setEditingId,
    addLayer,
    updateLayer,
    removeLayer,
    duplicateLayer,
    bringForward,
    sendBackward,
    deselectAll,
    FONT_FAMILIES,
  };
}

export type StoryTextManager = ReturnType<typeof useStoryTextManager>;
