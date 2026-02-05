import { motion } from "framer-motion";
import { X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface A2UICardProps {
  payload: any[];
  metadata?: {
    card_title?: string;
    confidence_score?: number;
    mission_id?: string;
  };
  cardType: string;
  onDelete: () => void;
}

export function A2UICard({ payload, metadata, cardType, onDelete }: A2UICardProps) {
  const confidenceColor =
    (metadata?.confidence_score ?? 1) > 0.7 ? "border-[#00FFFF]/50" : "border-red-500/50";

  return (
    <div
      className={`w-[400px] max-h-[500px] backdrop-blur-md bg-white/5 border ${confidenceColor} rounded-xl shadow-2xl overflow-hidden hover:border-[#FF00FF]/50 transition-colors`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">
            {metadata?.card_title || "Avionics Card"}
          </h3>
          {metadata?.confidence_score && (
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
          const children = componentData.children?.explicitList || [];
          return (
            <div key={comp.id || idx} className="space-y-2">
              {/* Render children recursively (simplified) */}
            </div>
          );
        }

        // Fallback for unknown components
        return null;
      })}
    </div>
  );
}
