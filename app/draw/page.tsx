"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  arrowWings,
  distance,
  lerpPath,
  recognizeShape,
  sampleShapeOutline,
  type Point,
  type RecognitionResult,
} from "@/lib/draw/recognize-shape";

type Stroke = {
  id: number;
  points: Point[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
};

type BoardShape = RecognitionResult & {
  id: number;
  color: string;
  width: number;
  sourcePoints: Point[];
};

const COLORS = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#9333ea"];
const MIN_POINTS = 3;
const RECOGNITION_DELAY = 400;
const MORPH_MS = 280;

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#111827");
  const [strokeWidth, setStrokeWidth] = useState(5);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<BoardShape[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [smartShapes, setSmartShapes] = useState(true);
  const [status, setStatus] = useState("Ready");

  const strokesRef = useRef<Stroke[]>([]);
  const shapesRef = useRef<BoardShape[]>([]);
  const currentPointsRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  const nextId = useRef(1);
  const smartShapesRef = useRef(smartShapes);
  const pendingRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const morphRef = useRef<Map<number, number>>(new Map());
  const redrawRef = useRef<() => void>(() => {});

  toolRef.current = tool;
  colorRef.current = color;
  widthRef.current = strokeWidth;
  smartShapesRef.current = smartShapes;

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawRef.current();
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const drawSmoothPath = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    strokeColor: string,
    width: number
  ) => {
    if (points.length < 2) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      ctx.quadraticCurveTo(
        current.x,
        current.y,
        (current.x + next.x) / 2,
        (current.y + next.y) / 2
      );
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  };

  const drawVectorShape = (
    ctx: CanvasRenderingContext2D,
    shape: BoardShape
  ) => {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    if (
      shape.type === "circle" &&
      shape.center &&
      shape.radiusX &&
      shape.radiusY
    ) {
      ctx.ellipse(
        shape.center.x,
        shape.center.y,
        shape.radiusX,
        shape.radiusY,
        shape.rotation ?? 0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      return;
    }

    if (shape.type === "line" && shape.points.length >= 2) {
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      ctx.lineTo(shape.points[1].x, shape.points[1].y);
      ctx.stroke();
      return;
    }

    if (
      (shape.type === "rectangle" || shape.type === "triangle") &&
      shape.points.length >= 3
    ) {
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (shape.type === "arrow" && shape.points.length >= 2) {
      const start = shape.points[0];
      const tip = shape.points[1];
      const wings = arrowWings(start, tip);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.moveTo(wings.left.x, wings.left.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(wings.right.x, wings.right.y);
      ctx.stroke();
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokesRef.current) {
      if (stroke.tool === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        drawSmoothPath(ctx, stroke.points, "#000", stroke.width);
        ctx.restore();
      } else {
        drawSmoothPath(ctx, stroke.points, stroke.color, stroke.width);
      }
    }

    for (const shape of shapesRef.current) {
      const morph = morphRef.current.get(shape.id);
      if (morph !== undefined && morph < 1) {
        try {
          const closed =
            shape.type === "circle" ||
            shape.type === "rectangle" ||
            shape.type === "triangle";
          const dest = sampleShapeOutline(shape);
          const frames = lerpPath(shape.sourcePoints, dest, morph, closed);
          drawSmoothPath(ctx, frames, shape.color, shape.width);
        } catch {
          drawVectorShape(ctx, shape);
        }
      } else {
        drawVectorShape(ctx, shape);
      }
    }

    if (currentPointsRef.current.length > 1) {
      const liveTool = toolRef.current;
      drawSmoothPath(
        ctx,
        currentPointsRef.current,
        liveTool === "eraser" ? "#000" : colorRef.current,
        widthRef.current
      );
    }
  };

  redrawRef.current = redrawCanvas;

  useEffect(() => {
    redrawCanvas();
  }, [strokes, shapes, color, strokeWidth, tool]);

  const getPoint = (
    event: React.PointerEvent<HTMLCanvasElement>
  ): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startMorph = (id: number) => {
    morphRef.current.set(id, 0);
    const started = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / MORPH_MS);
      const eased = 1 - (1 - t) * (1 - t);
      morphRef.current.set(id, eased);
      redrawRef.current();
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        morphRef.current.delete(id);
        redrawRef.current();
      }
    };

    requestAnimationFrame(tick);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    currentPointsRef.current = [point];
    drawingRef.current = true;
    setIsDrawing(true);
    setStatus("Drawing...");
    redrawRef.current();
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    const last = currentPointsRef.current[currentPointsRef.current.length - 1];
    if (last && distance(last, point) < 0.6) return;
    currentPointsRef.current = [...currentPointsRef.current, point];
    redrawRef.current();
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();

    const points = currentPointsRef.current.slice();
    drawingRef.current = false;
    setIsDrawing(false);

    if (points.length < 2) {
      currentPointsRef.current = [];
      setStatus("Ready");
      redrawRef.current();
      return;
    }

    const id = nextId.current++;
    const newStroke: Stroke = {
      id,
      points,
      color: colorRef.current,
      width: widthRef.current,
      tool: toolRef.current,
    };

    strokesRef.current = [...strokesRef.current, newStroke];
    currentPointsRef.current = [];
    setStrokes([...strokesRef.current]);
    redrawRef.current();

    if (newStroke.tool === "eraser") {
      setStatus("Erased");
      return;
    }

    if (!smartShapesRef.current || points.length < MIN_POINTS) {
      setStatus("Ink");
      return;
    }

    setStatus("Recognizing...");

    const timer = setTimeout(() => {
      if (!pendingRef.current.has(id)) {
        return;
      }
      pendingRef.current.delete(id);

      try {
        const result = recognizeShape(points);

        if (!result) {
          setStatus("Ink");
          redrawRef.current();
          return;
        }

        if (!strokesRef.current.some((stroke) => stroke.id === id)) {
          setStatus("Ink");
          return;
        }

        strokesRef.current = strokesRef.current.filter(
          (stroke) => stroke.id !== id
        );
        const recognized: BoardShape = {
          ...result,
          id,
          color: newStroke.color,
          width: newStroke.width,
          sourcePoints: points,
        };
        shapesRef.current = [...shapesRef.current, recognized];
        setStrokes([...strokesRef.current]);
        setShapes([...shapesRef.current]);
        startMorph(id);
        setStatus(`Smart ${result.label}`);
        redrawRef.current();
      } catch {
        setStatus("Ink");
        redrawRef.current();
      }
    }, RECOGNITION_DELAY);

    pendingRef.current.set(id, timer as ReturnType<typeof setTimeout>);
  };

  const undo = () => {
    const lastShape = shapesRef.current[shapesRef.current.length - 1];
    const lastStroke = strokesRef.current[strokesRef.current.length - 1];

    const lastShapeId = lastShape?.id ?? -1;
    const lastStrokeId = lastStroke?.id ?? -1;

    if (lastShapeId > lastStrokeId && lastShape) {
      shapesRef.current = shapesRef.current.slice(0, -1);
      setShapes([...shapesRef.current]);
      setStatus("Undo");
      redrawRef.current();
      return;
    }

    if (lastStroke) {
      const timer = pendingRef.current.get(lastStroke.id);
      if (timer) {
        clearTimeout(timer);
        pendingRef.current.delete(lastStroke.id);
      }
      strokesRef.current = strokesRef.current.slice(0, -1);
      setStrokes([...strokesRef.current]);
      setStatus("Undo");
      redrawRef.current();
    }
  };

  const clearBoard = () => {
    for (const timer of pendingRef.current.values()) {
      clearTimeout(timer);
    }
    pendingRef.current.clear();
    morphRef.current.clear();
    strokesRef.current = [];
    shapesRef.current = [];
    currentPointsRef.current = [];
    setStrokes([]);
    setShapes([]);
    setStatus("Cleared");
    redrawRef.current();
  };

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#f3f4f6",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <header
        style={{
          height: 72,
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 18,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: 20,
            marginRight: 12,
          }}
        >
          SmartBoard
        </div>

        <button
          onClick={() => setTool("pen")}
          style={buttonStyle(tool === "pen")}
        >
          ✏️ Pen
        </button>

        <button
          onClick={() => setTool("eraser")}
          style={buttonStyle(tool === "eraser")}
        >
          🧹 Eraser
        </button>

        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginLeft: 10,
          }}
        >
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setTool("pen");
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border:
                  color === c
                    ? "3px solid #111827"
                    : "2px solid #d1d5db",
                background: c,
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        <select
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          style={{
            height: 34,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "0 8px",
          }}
        >
          <option value={3}>Thin</option>
          <option value={5}>Medium</option>
          <option value={8}>Thick</option>
          <option value={12}>Marker</option>
        </select>

        <button
          onClick={() => setSmartShapes(!smartShapes)}
          style={{
            ...buttonStyle(smartShapes),
            marginLeft: 8,
          }}
        >
          ✨ Smart Shapes
        </button>

        <div style={{ flex: 1 }} />

        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            minWidth: 130,
            textAlign: "right",
          }}
        >
          {status}
        </div>

        <button onClick={undo} style={buttonStyle(false)}>
          ↶ Undo
        </button>

        <button
          onClick={clearBoard}
          style={{
            height: 38,
            padding: "0 14px",
            borderRadius: 9,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#dc2626",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Clear
        </button>
      </header>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          background: "white",
          margin: 14,
          borderRadius: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: tool === "eraser" ? "cell" : "crosshair",
            touchAction: "none",
          }}
        />

        {strokes.length === 0 &&
          shapes.length === 0 &&
          !isDrawing &&
          strokesRef.current.length === 0 &&
          shapesRef.current.length === 0 && (
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d1d5db",
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            Draw something...
          </div>
        )}

        {smartShapes && (
          <div
            style={{
              position: "absolute",
              bottom: 18,
              left: 18,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.9)",
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontSize: 12,
              color: "#6b7280",
              pointerEvents: "none",
            }}
          >
            ✨ Smart recognition ON
          </div>
        )}
      </div>
    </main>
  );
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    height: 38,
    padding: "0 13px",
    borderRadius: 9,
    border: active ? "1px solid #bfdbfe" : "1px solid #d1d5db",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#2563eb" : "#374151",
    cursor: "pointer",
    fontWeight: 600,
  };
}
