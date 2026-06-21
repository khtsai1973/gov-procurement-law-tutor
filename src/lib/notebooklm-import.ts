import fs from "node:fs/promises";
import path from "node:path";

import { RegulationTier, type PrismaClient } from "@prisma/client";
import { z } from "zod";

export const NOTEBOOKLM_DIR = path.join(process.cwd(), "data", "notebooklm");
export const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");
export const SLUG_PREFIX = "notebooklm-";

const tierSchema = z.enum(["INTERPRETATION", "ADMIN_RULE", "REGULATION"]);

const manifestSourceSchema = z.object({
  file: z.string().min(1),
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  tier: tierSchema.optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  notebook: z.string().optional(),
  relatedSlugs: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export const notebookLmManifestSchema = z.object({
  notebookTitle: z.string().optional(),
  notebookUrl: z.string().url().optional(),
  sources: z.array(manifestSourceSchema).min(1),
});

export type NotebookLmManifest = z.infer<typeof notebookLmManifestSchema>;
export type NotebookLmManifestSource = z.infer<typeof manifestSourceSchema>;

export type NotebookLmFrontmatter = {
  title?: string;
  slug?: string;
  tier?: z.infer<typeof tierSchema>;
  sourceUrl?: string;
  notebook?: string;
  notebookUrl?: string;
  relatedSlugs?: string[];
  sortOrder?: number;
};

export type NotebookLmImportEntry = {
  file: string;
  slug: string;
  title: string;
  tier: RegulationTier;
  sourceUrl: string | null;
  notebook: string | null;
  notes: string;
  sortOrder: number;
  body: string;
  relatedSlugs: string[];
};

export type NotebookLmImportResult = {
  imported: number;
  slugs: string[];
  skipped: string[];
  dryRun: boolean;
};

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".markdown"]);

export function slugifyNotebookLm(input: string): string {
  const base = input
    .replace(/\.[^.]+$/, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const slug = base || "note";
  return slug.startsWith(SLUG_PREFIX) ? slug : `${SLUG_PREFIX}${slug}`;
}

export function parseFrontmatter(raw: string): { meta: NotebookLmFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const meta: NotebookLmFrontmatter = {};
  for (const line of match[1]!.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf(":");
    if (sep <= 0) continue;
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === "title") meta.title = value;
    else if (key === "slug") meta.slug = value;
    else if (key === "tier" && tierSchema.safeParse(value).success) meta.tier = value as NotebookLmFrontmatter["tier"];
    else if (key === "sourceUrl") meta.sourceUrl = value;
    else if (key === "notebook") meta.notebook = value;
    else if (key === "notebookUrl") meta.notebookUrl = value;
    else if (key === "sortOrder") meta.sortOrder = Number(value);
    else if (key === "relatedSlugs") {
      meta.relatedSlugs = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }
  }

  return { meta, body: match[2]!.trim() };
}

function titleFromFilename(file: string): string {
  return path
    .basename(file, path.extname(file))
    .replace(/[-_]+/g, " ")
    .trim();
}

function tierFromMeta(meta: NotebookLmFrontmatter): RegulationTier {
  if (meta.tier === "REGULATION") return RegulationTier.REGULATION;
  if (meta.tier === "ADMIN_RULE") return RegulationTier.ADMIN_RULE;
  return RegulationTier.INTERPRETATION;
}

export function buildCorpusMarkdown(entry: NotebookLmImportEntry): string {
  const lines = [
    `# ${entry.title}`,
    "",
    `- 資料來源：NotebookLM${entry.notebook ? `（${entry.notebook}）` : ""}`,
  ];
  if (entry.sourceUrl) lines.push(`- NotebookLM 連結：${entry.sourceUrl}`);
  lines.push(`- 匯入 slug：\`${entry.slug}\``);
  if (entry.relatedSlugs.length > 0) {
    lines.push(`- 相關法規 slug：${entry.relatedSlugs.map((s) => `\`${s}\``).join("、")}`);
  }
  lines.push("- 備註：本檔由 NotebookLM 匯入腳本產生，僅供 RAG 參考；正式適用以原法規與工程會公告為準。");
  lines.push("", "---", "", entry.body.trim());
  return `${lines.join("\n")}\n`;
}

async function readSourceFile(dir: string, file: string): Promise<string> {
  const full = path.join(dir, file);
  return fs.readFile(full, "utf8");
}

export async function loadNotebookLmManifest(dir: string): Promise<NotebookLmManifest | null> {
  try {
    const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
    return notebookLmManifestSchema.parse(JSON.parse(raw) as unknown);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function discoverTextFiles(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => {
      const ext = path.extname(n).toLowerCase();
      return TEXT_EXTENSIONS.has(ext) && !n.startsWith("_") && n !== "README.md";
    })
    .sort();
}

function resolveEntryFromSource(
  dir: string,
  source: NotebookLmManifestSource,
  defaults: { notebookTitle?: string; notebookUrl?: string },
): Promise<NotebookLmImportEntry> {
  return readSourceFile(dir, source.file).then((raw) => {
    const { meta, body } = parseFrontmatter(raw);
    const slug = slugifyNotebookLm(source.slug ?? meta.slug ?? source.file);
    const title = source.title ?? meta.title ?? titleFromFilename(source.file);
    const notebook =
      source.notebook ?? meta.notebook ?? defaults.notebookTitle ?? null;
    const sourceUrl =
      source.sourceUrl || meta.sourceUrl || meta.notebookUrl || defaults.notebookUrl || null;
    return {
      file: source.file,
      slug,
      title,
      tier: tierFromMeta({ tier: source.tier ?? meta.tier }),
      sourceUrl,
      notebook,
      notes: `NotebookLM 匯入：${notebook ?? "未命名筆記本"}。`,
      sortOrder: source.sortOrder ?? meta.sortOrder ?? 900,
      body,
      relatedSlugs: source.relatedSlugs ?? meta.relatedSlugs ?? [],
    };
  });
}

export async function collectNotebookLmEntries(
  dir = NOTEBOOKLM_DIR,
  options: { notebookTitle?: string; notebookUrl?: string } = {},
): Promise<NotebookLmImportEntry[]> {
  const manifest = await loadNotebookLmManifest(dir);
  if (manifest) {
    return Promise.all(
      manifest.sources.map((source) =>
        resolveEntryFromSource(dir, source, {
          notebookTitle: options.notebookTitle ?? manifest.notebookTitle,
          notebookUrl: options.notebookUrl ?? manifest.notebookUrl,
        }),
      ),
    );
  }

  const files = await discoverTextFiles(dir);
  return Promise.all(
    files.map(async (file) => {
      const raw = await readSourceFile(dir, file);
      const { meta, body } = parseFrontmatter(raw);
      return {
        file,
        slug: slugifyNotebookLm(meta.slug ?? file),
        title: meta.title ?? titleFromFilename(file),
        tier: tierFromMeta(meta),
        sourceUrl: meta.sourceUrl ?? meta.notebookUrl ?? options.notebookUrl ?? null,
        notebook: meta.notebook ?? options.notebookTitle ?? null,
        notes: `NotebookLM 匯入：${meta.notebook ?? options.notebookTitle ?? "未命名筆記本"}。`,
        sortOrder: meta.sortOrder ?? 900,
        body,
        relatedSlugs: meta.relatedSlugs ?? [],
      };
    }),
  );
}

export async function importNotebookLmSources(
  prisma: PrismaClient,
  options: {
    dir?: string;
    dryRun?: boolean;
    notebookTitle?: string;
    notebookUrl?: string;
  } = {},
): Promise<NotebookLmImportResult> {
  const dir = options.dir ?? NOTEBOOKLM_DIR;
  const dryRun = options.dryRun ?? false;
  const entries = await collectNotebookLmEntries(dir, {
    notebookTitle: options.notebookTitle,
    notebookUrl: options.notebookUrl,
  });

  const slugs: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (!entry.body.trim()) {
      skipped.push(`${entry.file}（內容為空）`);
      continue;
    }

    slugs.push(entry.slug);
    if (dryRun) continue;

    await prisma.regulation.upsert({
      where: { slug: entry.slug },
      create: {
        slug: entry.slug,
        title: entry.title,
        tier: entry.tier,
        sortOrder: entry.sortOrder,
        sourceUrl: entry.sourceUrl,
        notes: entry.notes,
      },
      update: {
        title: entry.title,
        tier: entry.tier,
        sortOrder: entry.sortOrder,
        sourceUrl: entry.sourceUrl,
        notes: entry.notes,
      },
    });

    const corpusPath = path.join(CORPUS_DIR, `${entry.slug}.md`);
    await fs.mkdir(CORPUS_DIR, { recursive: true });
    await fs.writeFile(corpusPath, buildCorpusMarkdown(entry), "utf8");
  }

  return { imported: slugs.length, slugs, skipped, dryRun };
}
