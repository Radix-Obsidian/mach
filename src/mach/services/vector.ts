import type { SupabaseClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Document } from "@langchain/core/documents";

type VectorMetadata = {
  type: "code" | "doc" | "tribal";
  file_path?: string;
  repo?: string;
  [key: string]: unknown;
};

/**
 * Wraps LangChain's SupabaseVectorStore with OpenAI embeddings.
 * Uses text-embedding-3-small (1536 dims) — cheapest option.
 */
export class VectorService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: SupabaseVectorStore;

  constructor(private supabase: SupabaseClient) {
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.vectorStore = new SupabaseVectorStore(this.embeddings, {
      client: this.supabase,
      tableName: "mach_vectors",
      queryName: "match_mach_vectors",
    });
  }

  /**
   * Embed and store document chunks into the vector store.
   */
  async embedAndStore(chunks: { content: string; metadata: VectorMetadata }[]): Promise<void> {
    if (chunks.length === 0) return;

    const docs = chunks.map(
      (c) => new Document({ pageContent: c.content, metadata: c.metadata }),
    );

    // SupabaseVectorStore.addDocuments handles batching internally
    await this.vectorStore.addDocuments(docs);
    console.log(`[VectorService] ✅ Stored ${docs.length} chunks`);
  }

  /**
   * Similarity search against the vector store.
   */
  async search(
    query: string,
    filter?: { type: "code" | "doc" | "tribal" },
    k = 6,
  ): Promise<Document[]> {
    const results = await this.vectorStore.similaritySearch(query, k, filter ?? {});
    return results;
  }

  /**
   * Check if a repo has already been ingested.
   */
  async isRepoIngested(repoPrefix: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("mach_vectors")
      .select("id")
      .contains("metadata", { repo: repoPrefix })
      .limit(1);

    if (error) {
      console.error("[VectorService] ⚠️ Dedup check failed:", error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  }

  /**
   * Fetch a GitHub repo's key files, chunk them, and embed into the vector store.
   * Reuses the same GitHub API pattern from worker.ts fetchGitHubContext().
   */
  async ingestGitHubRepo(repoUrl: string): Promise<void> {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
    if (!match) {
      console.warn("[VectorService] ⚠️ Invalid GitHub URL:", repoUrl);
      return;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    const repoPrefix = `${owner}/${cleanRepo}`;

    // Dedup: skip if already ingested
    if (await this.isRepoIngested(repoPrefix)) {
      console.log(`[VectorService] ⏭️ Repo ${repoPrefix} already ingested, skipping`);
      return;
    }

    console.log(`[VectorService] 📥 Ingesting repo: ${repoPrefix}`);

    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const chunks: { content: string; metadata: VectorMetadata }[] = [];

    // Fetch repo tree (recursive, top-level files)
    const treeRes = await fetch(
      `https://api.github.com/repos/${repoPrefix}/git/trees/HEAD?recursive=1`,
      { headers },
    );

    if (!treeRes.ok) {
      console.error(`[VectorService] ⚠️ Tree fetch failed (${treeRes.status})`);
      return;
    }

    const treeData = (await treeRes.json()) as {
      tree: { path: string; type: string; size?: number }[];
    };

    // Filter to relevant source files (skip binaries, node_modules, large files)
    const relevantExts = /\.(ts|tsx|js|jsx|py|rs|go|sql|md|json|yaml|yml|toml|env\.example)$/;
    const skipPaths = /node_modules|dist|build|\.git|vendor|__pycache__|\.next/;

    const filesToFetch = treeData.tree.filter(
      (f) =>
        f.type === "blob" &&
        relevantExts.test(f.path) &&
        !skipPaths.test(f.path) &&
        (f.size ?? 0) < 100_000, // Skip files > 100KB
    );

    // Limit to 50 most important files to stay within API rate limits
    const priorityFiles = filesToFetch.slice(0, 50);

    console.log(
      `[VectorService] 📂 Fetching ${priorityFiles.length}/${filesToFetch.length} files`,
    );

    // Fetch file contents in batches of 5
    for (let i = 0; i < priorityFiles.length; i += 5) {
      const batch = priorityFiles.slice(i, i + 5);
      const batchResults = await Promise.allSettled(
        batch.map(async (file) => {
          const res = await fetch(
            `https://api.github.com/repos/${repoPrefix}/contents/${file.path}`,
            { headers },
          );
          if (!res.ok) return null;
          const data = (await res.json()) as { content?: string };
          if (!data.content) return null;
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          return { path: file.path, content };
        }),
      );

      for (const result of batchResults) {
        if (result.status !== "fulfilled" || !result.value) continue;
        const { path, content } = result.value;

        // Chunk the file content (~500 tokens ≈ ~2000 chars)
        const fileChunks = chunkText(content, 2000);
        for (const chunk of fileChunks) {
          chunks.push({
            content: `File: ${path}\n\n${chunk}`,
            metadata: {
              type: "code",
              file_path: path,
              repo: repoPrefix,
            },
          });
        }
      }
    }

    // Also fetch README as a 'doc' type
    const readmeRes = await fetch(
      `https://api.github.com/repos/${repoPrefix}/readme`,
      { headers },
    );
    if (readmeRes.ok) {
      const readmeData = (await readmeRes.json()) as { content?: string };
      if (readmeData.content) {
        const readme = Buffer.from(readmeData.content, "base64").toString("utf-8");
        const readmeChunks = chunkText(readme, 2000);
        for (const chunk of readmeChunks) {
          chunks.push({
            content: `README.md\n\n${chunk}`,
            metadata: { type: "doc", file_path: "README.md", repo: repoPrefix },
          });
        }
      }
    }

    if (chunks.length === 0) {
      console.warn(`[VectorService] ⚠️ No content extracted from ${repoPrefix}`);
      return;
    }

    console.log(`[VectorService] 📦 Embedding ${chunks.length} chunks from ${repoPrefix}`);
    await this.embedAndStore(chunks);
    console.log(`[VectorService] ✅ Repo ${repoPrefix} ingested successfully`);
  }
}

/**
 * Split text into chunks of approximately `maxChars` characters,
 * breaking at newline boundaries to preserve code structure.
 */
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
