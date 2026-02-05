import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, AlertTriangle, Paperclip, Github, ChevronDown, ChevronUp, X } from "lucide-react";

interface AuditOptions {
  repoUrl?: string;
  files?: File[];
  businessContext?: {
    revenue_model?: string;
    monthly_revenue?: number;
    user_count?: number;
  };
}

interface MissionInputProps {
  onSubmit: (value: string, options?: AuditOptions) => void;
  isLoading?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  message: string;
}

const validateObjective = (input: string): ValidationResult => {
  const trimmed = input.trim();
  
  // Too short
  if (trimmed.length < 10) {
    return { isValid: false, message: "REJECTED: Objective too brief. Minimum 10 characters required." };
  }
  
  // Single word or very vague
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 3) {
    return { isValid: false, message: "REJECTED: Objective too vague. Provide more context." };
  }
  
  // Only generic words
  const genericWords = ["app", "website", "thing", "stuff", "something", "build", "make", "create"];
  const words = trimmed.toLowerCase().split(/\s+/);
  const meaningfulWords = words.filter(w => !genericWords.includes(w) && w.length > 2);
  if (meaningfulWords.length < 2) {
    return { isValid: false, message: "REJECTED: Objective lacks specificity. Define a clear goal." };
  }
  
  return { isValid: true, message: "" };
};

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.md,.txt,.csv,.json";

const MissionInput = ({ onSubmit, isLoading }: MissionInputProps) => {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [revenueModel, setRevenueModel] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [userCount, setUserCount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateObjective(value);

    if (!validation.isValid) {
      setRejection(validation.message);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setRejection(null);

    const options: AuditOptions = {};
    if (repoUrl.trim()) options.repoUrl = repoUrl.trim();
    if (uploadedFiles.length > 0) options.files = uploadedFiles;

    const hasBusinessContext = revenueModel || monthlyRevenue || userCount;
    if (hasBusinessContext) {
      options.businessContext = {};
      if (revenueModel) options.businessContext.revenue_model = revenueModel;
      if (monthlyRevenue) options.businessContext.monthly_revenue = Number(monthlyRevenue);
      if (userCount) options.businessContext.user_count = Number(userCount);
    }

    onSubmit(value.trim(), Object.keys(options).length > 0 ? options : undefined);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (rejection) {
      setRejection(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isRejected = rejection !== null;
  const hasValue = value.trim().length > 0;
  const hasAuditData = repoUrl.trim() || uploadedFiles.length > 0 || revenueModel || monthlyRevenue || userCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-xl"
    >
      <form onSubmit={handleSubmit} className="relative">
        {/* Glow effect behind input */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{
            boxShadow: isRejected
              ? "0 0 40px hsl(20 90% 55% / 0.3), 0 0 80px hsl(20 90% 55% / 0.15)"
              : isFocused
              ? "0 0 40px hsl(175 80% 50% / 0.2), 0 0 80px hsl(175 80% 50% / 0.1)"
              : "0 0 20px hsl(175 80% 50% / 0.1)",
          }}
          transition={{ duration: 0.3 }}
        />

        <motion.div
          animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className={`relative rounded-2xl border-2 transition-all duration-300 bg-card/80 backdrop-blur-xl ${
            isRejected
              ? "border-[hsl(20,90%,55%)]/70"
              : isFocused
              ? "border-primary/50 animate-border-glow"
              : "border-border/50"
          }`}
        >
          <div className="flex items-center gap-3 p-2">
            <motion.div
              animate={{ rotate: isFocused ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              className="pl-3"
            >
              {isRejected ? (
                <AlertTriangle className="w-5 h-5 text-[hsl(20,90%,55%)]" />
              ) : (
                <Sparkles className={`w-5 h-5 transition-colors duration-300 ${
                  isFocused ? "text-primary" : "text-muted-foreground"
                }`} />
              )}
            </motion.div>

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter your mission objective..."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 font-mono text-sm focus:outline-none py-3"
            />

            <motion.button
              type="submit"
              disabled={!hasValue || isLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl transition-all duration-300 ${
                isRejected
                  ? "bg-[hsl(20,90%,55%)] text-white"
                  : hasValue && !isLoading
                  ? "bg-primary text-primary-foreground glow-shadow"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isLoading ? (
                <motion.div
                  className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Rejection message */}
        <AnimatePresence>
          {isRejected && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <p className="text-center text-xs text-[hsl(20,90%,55%)] mt-3 font-mono tracking-wide">
                {rejection}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audit panel toggle */}
        <div className="flex items-center justify-center mt-3 gap-2">
          <button
            type="button"
            onClick={() => setShowAuditPanel(!showAuditPanel)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            {showAuditPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {hasAuditData ? "Audit context attached" : "Add audit context"}
          </button>
          {hasAuditData && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Audit context panel */}
        <AnimatePresence>
          {showAuditPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3 p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
                {/* Repo URL */}
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="GitHub repo URL (optional)"
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/40 font-mono text-xs focus:outline-none border-b border-border/30 pb-1"
                  />
                </div>

                {/* File upload */}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                  >
                    <Paperclip className="w-4 h-4" />
                    Attach specs (PDF, DOCX, MD, TXT)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadedFiles.map((file, i) => (
                        <div key={`${file.name}-${i}`} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-muted-foreground/50">{(file.size / 1024).toFixed(0)}KB</span>
                          <button type="button" onClick={() => removeFile(i)} className="hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Business context */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground/60 font-mono">Business context</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={revenueModel}
                      onChange={(e) => setRevenueModel(e.target.value)}
                      placeholder="Revenue model"
                      className="bg-transparent text-foreground placeholder:text-muted-foreground/40 font-mono text-xs focus:outline-none border-b border-border/30 pb-1"
                    />
                    <input
                      type="number"
                      value={monthlyRevenue}
                      onChange={(e) => setMonthlyRevenue(e.target.value)}
                      placeholder="MRR ($)"
                      className="bg-transparent text-foreground placeholder:text-muted-foreground/40 font-mono text-xs focus:outline-none border-b border-border/30 pb-1"
                    />
                    <input
                      type="number"
                      value={userCount}
                      onChange={(e) => setUserCount(e.target.value)}
                      placeholder="Users"
                      className="bg-transparent text-foreground placeholder:text-muted-foreground/40 font-mono text-xs focus:outline-none border-b border-border/30 pb-1"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: isRejected ? 0 : isFocused ? 1 : 0.5 }}
          className="text-center text-xs text-muted-foreground mt-4 font-mono"
        >
          Press Enter to generate flight plan
        </motion.p>
      </form>
    </motion.div>
  );
};

export default MissionInput;
