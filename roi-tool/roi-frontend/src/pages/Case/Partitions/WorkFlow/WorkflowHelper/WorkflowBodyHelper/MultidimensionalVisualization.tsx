import React from "react";
import { Renderer2D } from "@/lib/bubble-chart/renderer-2d";
import { Renderer3D } from "@/lib/bubble-chart/renderer-3d";
import { coordinateDataset } from "@/lib/bubble-chart/dataset-coordinates";
import type {
  BubbleDataPoint,
  ChartMode,
  ColorScale,
} from "@/lib/bubble-chart/types";
import "./Workflow.css";

type Props = {
  workflowData: any;
};

type DatasetKind = "clusters" | "spiral" | "random" | "sphere" | "wave";

const DATASETS: { id: DatasetKind; label: string; description: string }[] = [
  { id: "clusters", label: "Clusters", description: "4 gaussian groups" },
  { id: "spiral", label: "Spiral", description: "Helical trajectory" },
  { id: "random", label: "Random", description: "Uniform distribution" },
  { id: "sphere", label: "Sphere", description: "Surface distribution" },
  { id: "wave", label: "Wave", description: "Sinusoidal surface" },
];

const COLOR_SCALES: {
  id: ColorScale;
  label: string;
  stops: string[];
}[] = [
  { id: "viridis", label: "Viridis", stops: ["#482173", "#2d8f88", "#fde725"] },
  { id: "plasma", label: "Plasma", stops: ["#24116f", "#e65d2f", "#f6e620"] },
  { id: "magma", label: "Magma", stops: ["#02020a", "#84206b", "#fff1a8"] },
  { id: "coolwarm", label: "Coolwarm", stops: ["#3b4cc0", "#d7dce4", "#b40426"] },
];

function makeDataset(kind: DatasetKind, count: number): BubbleDataPoint[] {
  const base = coordinateDataset.slice(0, count);

  if (kind === "clusters") {
    return base.map((point, index) => ({
      ...point,
      size: 0.55 + ((index % 7) / 12),
      category: `Group ${(index % 4) + 1}`,
    }));
  }

  if (kind === "spiral") {
    return Array.from({ length: Math.min(count, 160) }, (_, index) => {
      const t = index / 7;
      return {
        x: Math.cos(t) * (2 + t / 3),
        y: Math.sin(t) * (2 + t / 3),
        z: -9 + index * 0.14,
        value: index / Math.max(1, count - 1),
        size: 0.6,
        label: `SKU ${index + 1}`,
      };
    });
  }

  if (kind === "sphere") {
    return Array.from({ length: Math.min(count, 160) }, (_, index) => {
      const u = index / Math.max(1, count - 1);
      const theta = u * Math.PI * 2 * 5;
      const phi = Math.acos(1 - 2 * u);
      const radius = 9;
      return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        value: u,
        size: 0.45 + (index % 5) / 10,
        label: `SKU ${index + 1}`,
      };
    });
  }

  if (kind === "wave") {
    return base.map((point, index) => ({
      ...point,
      y: Math.sin(point.x / 2) * 4 + Math.cos(index / 6) * 2,
      z: Math.cos(point.x / 2) * 5,
      size: 0.45 + ((index % 6) / 12),
    }));
  }

  return base.map((point, index) => ({
    ...point,
    x: ((index * 37) % 29) - 14,
    y: ((index * 53) % 23) - 11,
    z: ((index * 71) % 31) - 15,
    size: 0.45 + ((index % 9) / 13),
  }));
}

function BubbleRenderer({
  mode,
  data,
  colorScale,
}: {
  mode: ChartMode;
  data: BubbleDataPoint[];
  colorScale: ColorScale;
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const threeRef = React.useRef<HTMLDivElement | null>(null);
  const labelsRef = React.useRef<HTMLDivElement | null>(null);
  const rendererRef = React.useRef<Renderer2D | Renderer3D | null>(null);

  React.useEffect(() => {
    rendererRef.current?.dispose();
    rendererRef.current = null;

    if (mode === "2d" && canvasRef.current) {
      rendererRef.current = new Renderer2D(
        canvasRef.current,
        {},
        {
          colorScale,
          minSize: 15,
          maxSize: 26,
          opacity: 0.82,
        },
        {
          padding: 58,
          gridColor: "rgba(159, 166, 179, 0.23)",
          axisColor: "#9ca3af",
          tickCount: 6,
        },
      );
    }

    if (mode === "3d" && threeRef.current && labelsRef.current) {
      rendererRef.current = new Renderer3D(
        threeRef.current,
        labelsRef.current,
        {},
        {
          gridOpacity: 0.22,
          gridDivisions: 16,
          labelColor: "#6f7481",
        },
        {
          colorScale,
          opacity: 0.66,
          minSize: 0.08,
          maxSize: 0.26,
        },
        {
          initialPosition: [11, 9, 12],
          enablePan: true,
        },
      );
    }

    rendererRef.current?.setData(data, { x: "X Axis", y: "Y Axis", z: "Z Axis" });

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [mode]);

  React.useEffect(() => {
    rendererRef.current?.updatePointConfig?.({ colorScale });
    rendererRef.current?.setData(data, { x: "X Axis", y: "Y Axis", z: "Z Axis" });
  }, [colorScale, data]);

  React.useEffect(() => {
    const node = mode === "2d" ? canvasRef.current : threeRef.current;
    const wrapper = wrapperRef.current;
    if (!node || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (mode === "2d" && rendererRef.current instanceof Renderer2D) {
        rendererRef.current.handleResize(rect.width, rect.height);
      } else if (mode === "3d" && rendererRef.current instanceof Renderer3D) {
        rendererRef.current.handleResize();
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [mode]);

  const handleMouseMove = (event: React.MouseEvent) => {
    rendererRef.current?.handleMouseMove(event.clientX, event.clientY);
  };

  const handleClick = (event: React.MouseEvent) => {
    rendererRef.current?.handleClick(event.clientX, event.clientY);
  };

  return (
    <div ref={wrapperRef} className="mdviz-chart-frame">
      {mode === "2d" ? (
        <canvas
          ref={canvasRef}
          className="mdviz-canvas"
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseLeave={() => rendererRef.current?.handleMouseLeave()}
        />
      ) : (
        <div
          ref={threeRef}
          className="mdviz-three"
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseLeave={() => rendererRef.current?.handleMouseLeave()}
        >
          <div ref={labelsRef} className="mdviz-three-labels" />
        </div>
      )}
    </div>
  );
}

function VisualizationSidebar({
  mode,
  dataset,
  count,
  colorScale,
  onModeChange,
  onDatasetChange,
  onCountChange,
  onColorScaleChange,
}: {
  mode: ChartMode;
  dataset: DatasetKind;
  count: number;
  colorScale: ColorScale;
  onModeChange: (mode: ChartMode) => void;
  onDatasetChange: (dataset: DatasetKind) => void;
  onCountChange: (count: number) => void;
  onColorScaleChange: (scale: ColorScale) => void;
}) {
  return (
    <aside className="mdviz-sidebar">
      <div className="mdviz-sidebar__heading">Visualization</div>

      <div className="mdviz-mode-toggle" aria-label="Chart mode">
        <button
          type="button"
          className={mode === "2d" ? "is-active" : ""}
          onClick={() => onModeChange("2d")}
        >
          <span className="mdviz-mode-icon mdviz-mode-icon--square" />
          2D
        </button>
        <button
          type="button"
          className={mode === "3d" ? "is-active" : ""}
          onClick={() => onModeChange("3d")}
        >
          <span className="mdviz-mode-icon mdviz-mode-icon--cube" />
          3D
        </button>
      </div>

      <section className="mdviz-panel-section">
        <button type="button" className="mdviz-section-button">
          <span>#</span>
          Dataset
        </button>
        <div className="mdviz-dataset-list">
          {DATASETS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={dataset === item.id ? "is-active" : ""}
              onClick={() => onDatasetChange(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mdviz-panel-section">
        <button type="button" className="mdviz-section-button">
          <span>#</span>
          Points
        </button>
        <div className="mdviz-slider-row">
          <label>
            Count
            <strong>{count.toLocaleString()}</strong>
          </label>
          <input
            type="range"
            min="40"
            max={coordinateDataset.length}
            value={count}
            onChange={(event) => onCountChange(Number(event.target.value))}
          />
          <div className="mdviz-scale-marks">
            <span>40</span>
            <span>80</span>
            <span>120</span>
          </div>
        </div>
      </section>

      <section className="mdviz-panel-section">
        <button type="button" className="mdviz-section-button">
          <span>#</span>
          Color Scale
        </button>
        <div className="mdviz-color-scales">
          {COLOR_SCALES.map((scale) => (
            <button
              type="button"
              key={scale.id}
              className={colorScale === scale.id ? "is-active" : ""}
              onClick={() => onColorScaleChange(scale.id)}
            >
              <span
                className="mdviz-check"
                aria-hidden="true"
              />
              <span
                className="mdviz-gradient"
                style={{
                  background: `linear-gradient(90deg, ${scale.stops.join(", ")})`,
                }}
              />
              <strong>{scale.label}</strong>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function MultidimensionalVisualization({ workflowData }: Props) {
  const [mode, setMode] = React.useState<ChartMode>("2d");
  const [dataset, setDataset] = React.useState<DatasetKind>("clusters");
  const [count, setCount] = React.useState(120);
  const [colorScale, setColorScale] = React.useState<ColorScale>("viridis");

  const data = React.useMemo(() => {
    const raw =
      workflowData?.data?.mds?.coordinates ??
      workflowData?.data?.steps?.mds?.result?.coordinates ??
      null;

    if (Array.isArray(raw)) {
      return raw.slice(0, count) as BubbleDataPoint[];
    }

    return makeDataset(dataset, count);
  }, [count, dataset, workflowData]);

  return (
    <div className="workflow-mdviz">
      <VisualizationSidebar
        mode={mode}
        dataset={dataset}
        count={count}
        colorScale={colorScale}
        onModeChange={setMode}
        onDatasetChange={setDataset}
        onCountChange={setCount}
        onColorScaleChange={setColorScale}
      />

      <main className="mdviz-stage">
        <div className="mdviz-stage-toolbar">
          <span>{data.length} pts</span>
          <button type="button" aria-label="Expand visualization">
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <BubbleRenderer mode={mode} data={data} colorScale={colorScale} />
        <div className="mdviz-axis-legend">
          <span><i className="x" />X Axis</span>
          <span><i className="y" />Y Axis</span>
          {mode === "3d" ? <span><i className="z" />Z Axis</span> : null}
        </div>
      </main>
    </div>
  );
}
