import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

// Lazy Supabase init — env vars are loaded by server.ts before first request
let _supabase: ReturnType<typeof createClient> | null | undefined;
function getSupabase() {
  if (_supabase === undefined) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    _supabase = url && key ? createClient(url, key) : null;
  }
  return _supabase;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB ceiling for spec docs
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".md", ".txt", ".csv", ".json"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
  "text/csv",
  "application/json",
]);

function validateUpload(
  fileName: string,
  fileType: string,
  fileSize: number,
): { valid: boolean; error?: string } {
  const trimmedName = (fileName ?? "").trim();
  if (!trimmedName) {
    return { valid: false, error: "File name is required" };
  }

  if (trimmedName.length > 120) {
    return { valid: false, error: "File name is too long (max 120 characters)" };
  }

  const hasTraversal = /\.\.\//.test(trimmedName) || /\.\.\\/.test(trimmedName);
  if (hasTraversal || /[\\/]/.test(trimmedName) || /^[\\/]/.test(trimmedName)) {
    return { valid: false, error: "File name contains invalid path characters" };
  }

  if (/[<>:"|?*]/.test(trimmedName)) {
    return { valid: false, error: "File name contains unsupported characters" };
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { valid: false, error: "File size must be a positive number" };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File exceeds 20MB limit" };
  }

  const mime = (fileType ?? "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return { valid: false, error: "Unsupported file type" };
  }

  const extIndex = trimmedName.lastIndexOf(".");
  const ext = extIndex >= 0 ? trimmedName.slice(extIndex).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: "File extension not allowed" };
  }

  return { valid: true };
}

// Upload document to a mission
router.post("/missions/:id/documents", async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { id } = req.params;
  const { fileName, fileData, fileType } = req.body as {
    fileName: string;
    fileData: string; // base64
    fileType: string;
  };

  if (!fileName || !fileData || !fileType) {
    return res.status(400).json({ error: "fileName, fileData, fileType required" });
  }

  const buffer = Buffer.from(fileData, "base64");

  const validation = validateUpload(fileName, fileType, buffer.length);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const filePath = `missions/${id}/${Date.now()}-${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("mission-documents")
      .upload(filePath, buffer, { contentType: fileType });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("mission-documents")
      .getPublicUrl(filePath);

    const docMetadata = {
      name: fileName,
      url: urlData.publicUrl,
      type: fileType,
      size: buffer.length,
    };

    // Append to mission's spec_documents array
    const { data: mission, error: fetchError } = await supabase
      .from("missions")
      .select("spec_documents")
      .eq("id", id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "Mission not found" });
    }

    const existing = (mission.spec_documents ?? []) as Array<{
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
    const updatedDocs = [...existing, docMetadata];

    const { error: updateError } = await supabase
      .from("missions")
      .update({ spec_documents: updatedDocs })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(201).json(docMetadata);
  } catch (err) {
    console.error("[Mach Documents] Upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as documentsRouter };
