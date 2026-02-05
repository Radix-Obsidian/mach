import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { A2UICard } from "@/components/A2UICard";
import { Button } from "@/components/ui/button";
import { useMachDeck } from "@/hooks/useMachDeck";

export default function MachDeck() {
  const navigate = useNavigate();
  const { canvas, cards, loading, deleteCard, updateCardPosition } = useMachDeck();
  const [physicsMode, setPhysicsMode] = useState(false);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Initialize positions from cards
  useEffect(() => {
    if (cards && cards.length > 0) {
      const newPositions: Record<string, { x: number; y: number }> = {};
      cards.forEach((card) => {
        newPositions[card.id] = { x: card.position_x, y: card.position_y };
      });
      setPositions(newPositions);
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
            <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text">
              Mach Deck
            </h1>
            <span className="text-xs font-mono text-[#A1A8B3]">
              {cards?.length || 0} Avionics Cards
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Physics Mode Toggle */}
            <Button
              variant={physicsMode ? "default" : "outline"}
              onClick={() => setPhysicsMode(!physicsMode)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Zap className="w-4 h-4 mr-2" />
              {physicsMode ? "Physics Mode" : "Default View"}
            </Button>

            {/* Roast the Deck (Elon Mode) */}
            <Button
              variant="outline"
              onClick={() => {
                alert("🔥 Roasting the Deck... (delete stale cards coming soon)");
              }}
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

// Draggable card component
interface DraggableCardProps {
  card: any;
  position: { x: number; y: number };
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDelete: () => void;
}

function DraggableCard({
  card,
  position,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
}: DraggableCardProps) {
  const [localPos, setLocalPos] = useState(position);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setLocalPos(position);
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
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

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      onDragEnd(localPos.x, localPos.y);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
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
        />
      </motion.div>
    </motion.div>
  );
}
