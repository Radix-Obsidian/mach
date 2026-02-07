import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Activity, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { A2UICard } from "@/components/A2UICard";
import { Button } from "@/components/ui/button";
import { useMachDeck } from "@/hooks/useMachDeck";
import { toast } from "@/hooks/use-toast";

export default function MachDeck() {
  const navigate = useNavigate();
  const { canvas, cards, loading, deleteCard, updateCardPosition, roastDeck } = useMachDeck();
  const [physicsMode, setPhysicsMode] = useState(false);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const initializedRef = useRef(false);
  const [showRoastDialog, setShowRoastDialog] = useState(false);
  const [roastCriteria, setRoastCriteria] = useState({
    max_entropy: 75,
    max_age_days: 30,
    min_confidence: 0.3,
  });
  const [isRoasting, setIsRoasting] = useState(false);

  // Initialize positions: on first load, set all. After that, only add genuinely new cards.
  useEffect(() => {
    if (!cards || cards.length === 0) return;

    if (!initializedRef.current) {
      // First load: populate positions for all cards
      const allPositions: Record<string, { x: number; y: number }> = {};
      cards.forEach((card) => {
        allPositions[card.id] = { x: card.position_x, y: card.position_y };
      });
      setPositions(allPositions);
      initializedRef.current = true;
    } else {
      // Subsequent updates: only add positions for cards NOT already tracked
      setPositions((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const card of cards) {
          if (!(card.id in next)) {
            next[card.id] = { x: card.position_x, y: card.position_y };
            changed = true;
          }
        }
        // Also remove positions for deleted cards
        for (const id of Object.keys(next)) {
          if (!cards.some((c) => c.id === id)) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [cards]);

  const handleCardDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleCardDragEnd = async (cardId: string, x: number, y: number) => {
    setDraggedCard(null);
    setPositions((prev) => ({
      ...prev,
      [cardId]: { x, y },
    }));
    await updateCardPosition(cardId, x, y);
  };

  const handleRoast = async () => {
    setIsRoasting(true);
    const result = await roastDeck(roastCriteria);
    setIsRoasting(false);
    setShowRoastDialog(false);

    if (result.deleted_count > 0) {
      // Remove roasted cards from positions
      setPositions((prev) => {
        const next = { ...prev };
        for (const id of result.cards_deleted) {
          delete next[id];
        }
        return next;
      });
    }

    toast({
      title: result.deleted_count > 0 ? "Deck Roasted" : "Deck is Clean",
      description: result.deleted_count > 0
        ? `${result.deleted_count} stale card${result.deleted_count === 1 ? "" : "s"} purged.`
        : "No cards matched the staleness criteria.",
    });
  };

  const handleDeleteCard = async (cardId: string) => {
    await deleteCard(cardId);
    setPositions((prev) => {
      const newPositions = { ...prev };
      delete newPositions[cardId];
      return newPositions;
    });
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#0F172A] via-[#1a1f3a] to-[#0F172A] relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-40">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FF00FF] to-transparent blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "10%", left: "20%" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#00FFFF] to-transparent blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          style={{ bottom: "20%", right: "15%" }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="absolute top-0 left-0 right-0 z-50 p-6 backdrop-blur-md bg-white/5 border-b border-white/10"
      >
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-white">
              Mach Deck
            </h1>
            <span className="text-xs font-mono text-[#A1A8B3]">
              {cards?.length || 0} Avionics Cards
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Health Check Toggle — glows amber if any card has entropy >60 or velocity >7d */}
            <Button
              variant={physicsMode ? "default" : "outline"}
              onClick={() => setPhysicsMode(!physicsMode)}
              className={`border-white/20 text-white hover:bg-white/10 ${
                !physicsMode && hasUnhealthyCards(cards)
                  ? "border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : ""
              }`}
            >
              <Activity className="w-4 h-4 mr-2" />
              {physicsMode ? "Health Check" : "Default View"}
            </Button>

            {/* Roast the Deck */}
            <Button
              variant="outline"
              onClick={() => setShowRoastDialog(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Roast the Deck
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Canvas Area */}
      <div className="absolute inset-0 pt-[88px] overflow-auto">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Cards Container */}
        <div className="relative w-full h-full">
          <AnimatePresence>
            {cards &&
              cards.map((card) => (
                <DraggableCard
                  key={card.id}
                  card={card}
                  position={positions[card.id] || { x: card.position_x, y: card.position_y }}
                  isDragging={draggedCard === card.id}
                  physicsMode={physicsMode}
                  onDragStart={() => handleCardDragStart(card.id)}
                  onDragEnd={(x, y) => handleCardDragEnd(card.id, x, y)}
                  onDelete={() => handleDeleteCard(card.id)}
                />
              ))}
          </AnimatePresence>

          {/* Empty State */}
          {!loading && (!cards || cards.length === 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center flex-col gap-4"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Mach Deck</h2>
                <p className="text-[#A1A8B3]">
                  Complete a mission in the app to generate your first avionics card
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Roast Confirmation Dialog */}
      <AnimatePresence>
        {showRoastDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRoastDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1f3a] border border-red-500/30 rounded-2xl p-6 w-[400px] max-w-[90vw] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-1">Roast the Deck</h3>
              <p className="text-sm text-[#A1A8B3] mb-5">
                Purge stale and low-quality cards matching these criteria:
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-mono text-[#A1A8B3] block mb-1.5">
                    Max Entropy Score (cards above this get roasted)
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={roastCriteria.max_entropy}
                    onChange={(e) => setRoastCriteria((p) => ({ ...p, max_entropy: Number(e.target.value) }))}
                    className="w-full accent-red-500"
                  />
                  <span className="text-xs font-mono text-red-400">{roastCriteria.max_entropy}</span>
                </div>

                <div>
                  <label className="text-xs font-mono text-[#A1A8B3] block mb-1.5">
                    Max Age (days — older cards get roasted)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={90}
                    value={roastCriteria.max_age_days}
                    onChange={(e) => setRoastCriteria((p) => ({ ...p, max_age_days: Number(e.target.value) }))}
                    className="w-full accent-red-500"
                  />
                  <span className="text-xs font-mono text-red-400">{roastCriteria.max_age_days} days</span>
                </div>

                <div>
                  <label className="text-xs font-mono text-[#A1A8B3] block mb-1.5">
                    Min Confidence (cards below this get roasted)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(roastCriteria.min_confidence * 100)}
                    onChange={(e) => setRoastCriteria((p) => ({ ...p, min_confidence: Number(e.target.value) / 100 }))}
                    className="w-full accent-red-500"
                  />
                  <span className="text-xs font-mono text-red-400">{Math.round(roastCriteria.min_confidence * 100)}%</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                  onClick={() => setShowRoastDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleRoast}
                  disabled={isRoasting}
                >
                  {isRoasting ? "Roasting..." : "Roast"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0F172A]/80 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-[#FF00FF] border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white font-mono">Loading Mach Deck...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Check if any card on the deck has high entropy or stale velocity */
function hasUnhealthyCards(cards: any[]): boolean {
  if (!cards?.length) return false;
  const now = Date.now();
  return cards.some((card) => {
    const meta = card.metadata;
    if (!meta) return false;
    if ((meta.entropy_score ?? 0) > 60) return true;
    if (meta.created_at_epoch) {
      const days = (now - meta.created_at_epoch) / 86400000;
      if (days > 7) return true;
    }
    return false;
  });
}

// Draggable card component
interface DraggableCardProps {
  card: any;
  position: { x: number; y: number };
  isDragging: boolean;
  physicsMode: boolean;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDelete: () => void;
}

function DraggableCard({
  card,
  position,
  isDragging,
  physicsMode,
  onDragStart,
  onDragEnd,
  onDelete,
}: DraggableCardProps) {
  const [localPos, setLocalPos] = useState(position);
  const isDraggingRef = useRef(false);

  // Only sync from prop if NOT currently dragging AND position actually changed
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (position.x === localPos.x && position.y === localPos.y) return;
    setLocalPos(position);
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    onDragStart();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = localPos.x;
    const startPosY = localPos.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      setLocalPos({
        x: startPosX + deltaX,
        y: startPosY + deltaY,
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      isDraggingRef.current = false;
      // Compute final position from deltas (avoids stale closure on localPos)
      const finalX = startPosX + (upEvent.clientX - startX);
      const finalY = startPosY + (upEvent.clientY - startY);
      onDragEnd(finalX, finalY);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="absolute"
      style={{
        left: `${localPos.x}px`,
        top: `${localPos.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <motion.div
        animate={{
          boxShadow: isDragging
            ? "0 20px 40px rgba(255, 0, 255, 0.3)"
            : "0 10px 30px rgba(0, 255, 255, 0.1)",
        }}
        className={`cursor-grab ${isDragging ? "cursor-grabbing" : ""}`}
      >
        <A2UICard
          payload={card.a2ui_payload}
          metadata={card.metadata}
          cardType={card.card_type}
          onDelete={onDelete}
          physicsMode={physicsMode}
        />
      </motion.div>
    </motion.div>
  );
}
