import { X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CardMetadata {
  card_title?: string;
  confidence_score?: number;
  mission_id?: string;
  flight_status?: "approved" | "rejected";
  flight_label?: "MACH-1" | "LAMINAR" | "PURE CHAOS";
  entropy_score?: number;
  vectors?: {
    compressionRatio: number;
    ambiguityDensity: number;
    specificityMass: number;
    structuralIntegrity: number;
  };
  created_at_epoch?: number;
  word_count?: number;
}

interface A2UICardProps {
  payload: any[];
  metadata?: CardMetadata;
  cardType: string;
  onDelete: () => void;
  physicsMode?: boolean;
}

export function A2UICard({ payload, metadata, cardType, onDelete, physicsMode }: A2UICardProps) {
  const confidenceColor =
    (metadata?.confidence_score ?? 1) > 0.7 ? "border-[#00FFFF]/50" : "border-red-500/50";

  // Health Check Mode: Avionics metric display
  if (physicsMode) {
    const entropy = metadata?.entropy_score ?? 50;
    const velocityDays = metadata?.created_at_epoch
      ? Math.floor((Date.now() - metadata.created_at_epoch) / 86400000)
      : 0;
    const confidence = metadata?.confidence_score ?? 0.5;
    const wordCount = metadata?.word_count ?? 0;
    const isRejected = metadata?.flight_status === "rejected";
    const label = isRejected ? "SCRUBBED" : metadata?.flight_label || "LAMINAR";

    // Derive the alert status
    const alertStatus = getAlertStatus(entropy, velocityDays, confidence, wordCount);

    // Header border color matches status
    const headerBorder = isRejected ? "border-red-500/40" : "border-[#00FFFF]/40";
    const headerBg = isRejected ? "bg-red-500/10" : "bg-[#00FFFF]/5";
    const headerText = isRejected ? "text-red-400" : "text-[#00FFFF]";

    return (
      <div
        className={`w-[320px] bg-black/90 border ${headerBorder} rounded-md font-mono text-xs overflow-hidden`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 ${headerBg} border-b ${headerBorder}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[#A1A8B3] text-[10px] uppercase tracking-wider">Avionics</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${headerText}`}>
              {label}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-5 w-5 text-[#A1A8B3]/50 hover:text-red-400 hover:bg-red-500/10"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        {/* Metric Bars */}
        <div className="px-3 py-2.5 space-y-2">
          <MetricBar
            label="ENTROPY"
            value={entropy}
            displayValue={String(entropy)}
            maxValue={100}
            colorFn={(v) =>
              v <= 15 ? "#00FFFF" : v <= 45 ? "#22C55E" : v <= 75 ? "#F59E0B" : "#EF4444"
            }
          />
          <MetricBar
            label="VELOCITY"
            value={Math.min(velocityDays, 30)}
            displayValue={`${velocityDays}d on deck`}
            maxValue={30}
            colorFn={(v) => (v <= 3 ? "#22C55E" : v <= 7 ? "#F59E0B" : "#EF4444")}
          />
          <MetricBar
            label="CONFIDENCE"
            value={Math.round(confidence * 100)}
            displayValue={`${Math.round(confidence * 100)}%`}
            maxValue={100}
            colorFn={(v) => (v < 50 ? "#EF4444" : v < 70 ? "#F59E0B" : "#22C55E")}
          />
          <MetricBar
            label="SUBSTANCE"
            value={Math.min(wordCount, 1000)}
            displayValue={`${wordCount} words`}
            maxValue={1000}
            colorFn={(v) => (v < 100 ? "#EF4444" : v < 300 ? "#F59E0B" : "#22C55E")}
          />
        </div>

        {/* Alert bar — overall health status */}
        <div
          className={`px-3 py-1.5 border-t text-[10px] font-bold tracking-wider ${alertStatus.className}`}
        >
          {alertStatus.icon} {alertStatus.message}
        </div>
      </div>
    );
  }

  // Flight status badge config
  const flightLabel = metadata?.flight_label;
  const isRejected = metadata?.flight_status === "rejected";
  const badgeText = isRejected ? "SCRUBBED" : flightLabel || "LAMINAR";
  const badgeColor = isRejected
    ? "bg-red-500/15 text-red-400 border-red-500/30"
    : "bg-[#00FFFF]/10 text-[#00FFFF] border-[#00FFFF]/30";

  // Default Mode: full glassmorphism card
  return (
    <div
      className={`w-[400px] max-h-[500px] backdrop-blur-md bg-white/5 border ${confidenceColor} rounded-xl shadow-2xl overflow-hidden hover:border-[#FF00FF]/50 transition-colors`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}
          >
            {badgeText}
          </span>
          {metadata?.confidence_score != null && (
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${
                metadata.confidence_score > 0.7
                  ? "bg-[#00FFFF]/10 text-[#00FFFF]"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {Math.round(metadata.confidence_score * 100)}%
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-6 w-6 text-[#A1A8B3] hover:text-red-400 hover:bg-red-500/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Card Content - A2UI Rendering */}
      <div className="p-4 overflow-y-auto max-h-[420px]">
        <RenderA2UIPayload payload={payload} />
      </div>

      {/* Confidence Warning */}
      {metadata?.confidence_score && metadata.confidence_score < 0.7 && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border-t border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">Low confidence signal - verify data quality</p>
        </div>
      )}
    </div>
  );
}

// 10-segment metric bar component for Health Check mode
function MetricBar({
  label,
  value,
  displayValue,
  maxValue,
  colorFn,
}: {
  label: string;
  value: number;
  displayValue: string;
  maxValue: number;
  colorFn: (value: number) => string;
}) {
  const filled = Math.round((value / maxValue) * 10);
  const color = colorFn(value);
  const bar = "\u2588".repeat(Math.min(filled, 10)) + "\u2591".repeat(Math.max(0, 10 - filled));

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#A1A8B3] w-[80px] text-[10px] uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className="text-[11px] tracking-tight shrink-0" style={{ color }}>
        {bar}
      </span>
      <span className="text-[10px] text-right shrink-0 min-w-[60px]" style={{ color }}>
        {displayValue}
      </span>
    </div>
  );
}

/** Tri-level alert status: nominal (green), caution (amber), alert (red) */
function getAlertStatus(
  entropy: number,
  velocityDays: number,
  confidence: number,
  wordCount: number,
): { message: string; icon: string; className: string } {
  // Determine worst-case severity across all metrics
  const issues: string[] = [];
  if (entropy > 75) issues.push("HIGH ENTROPY");
  else if (entropy > 45) issues.push("ENTROPY WARNING");
  if (velocityDays > 7) issues.push("STALE");
  else if (velocityDays > 3) issues.push("AGING");
  if (confidence < 0.5) issues.push("LOW CONFIDENCE");
  if (wordCount < 100) issues.push("NO SUBSTANCE");

  if (issues.length === 0) {
    return {
      message: "ALL SYSTEMS NOMINAL",
      icon: "\u2713",
      className: "border-[#22C55E]/30 bg-[#22C55E]/5 text-[#22C55E]",
    };
  }

  // Red alert if any critical issue
  const hasCritical = entropy > 75 || confidence < 0.5 || velocityDays > 7 || wordCount < 100;
  if (hasCritical) {
    return {
      message: `ALERT: ${issues[0]}`,
      icon: "\u26A0",
      className: "border-red-500/30 bg-red-500/5 text-red-400",
    };
  }

  // Amber warning
  return {
    message: `CAUTION: ${issues[0]}`,
    icon: "\u26A0",
    className: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  };
}

// Simplified A2UI renderer for MVP
function RenderA2UIPayload({ payload }: { payload: any[] }) {
  if (!payload || payload.length === 0) {
    return <p className="text-[#A1A8B3] text-sm">No data</p>;
  }

  // Extract components from surfaceUpdate
  const surfaceUpdate = payload.find((p) => p.surfaceUpdate);
  if (!surfaceUpdate?.surfaceUpdate?.components) {
    return <p className="text-[#A1A8B3] text-sm">Invalid A2UI payload</p>;
  }

  const components = surfaceUpdate.surfaceUpdate.components;

  return (
    <div className="space-y-3">
      {components.map((comp: any, idx: number) => {
        const componentType = Object.keys(comp.component)[0];
        const componentData = comp.component[componentType];

        // Render based on component type
        if (componentType === "Text") {
          const text = componentData.text?.literalString || "";
          const usageHint = componentData.usageHint || "body";

          if (usageHint === "h1" || usageHint === "h2" || usageHint === "h3") {
            return (
              <h3
                key={comp.id || idx}
                className="text-lg font-bold text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text"
              >
                {text}
              </h3>
            );
          }

          if (usageHint === "h4") {
            return (
              <h4 key={comp.id || idx} className="text-sm font-bold text-[#00FFFF]">
                {text}
              </h4>
            );
          }

          if (usageHint === "caption") {
            return (
              <p key={comp.id || idx} className="text-xs text-[#A1A8B3] font-mono leading-relaxed">
                {text}
              </p>
            );
          }

          return (
            <p
              key={comp.id || idx}
              className="text-sm text-white whitespace-pre-wrap leading-relaxed"
            >
              {text}
            </p>
          );
        }

        if (componentType === "Divider") {
          return <div key={comp.id || idx} className="h-px bg-white/10 my-2" />;
        }

        if (componentType === "Column") {
          return (
            <div key={comp.id || idx} className="space-y-2">
              {/* Column children rendered via top-level components */}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
