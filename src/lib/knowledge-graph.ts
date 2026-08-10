/**
 * GraphRAG（輕量）：以條號將母法、施行細則、函釋建立關聯圖譜，
 * 命中母法條文時自動拉出同條號細則／函釋脈絡。
 */

export type GraphNodeTier = "LAW" | "REGULATION" | "ADMIN_RULE" | "INTERPRETATION" | string;

export type GraphChunkRef = {
  id: string;
  regulationSlug: string;
  regulationTitle: string;
  tier: GraphNodeTier;
  articleKey: string | null;
  content: string;
};

export type KnowledgeGraphEdge = {
  fromId: string;
  toId: string;
  relation: "SAME_ARTICLE" | "MENTIONS_ARTICLE";
  articleKey: string;
};

export type KnowledgeGraph = {
  /** 正規化條號 → 節點 id 列表 */
  byArticle: Map<string, string[]>;
  nodes: Map<string, GraphChunkRef>;
  edges: KnowledgeGraphEdge[];
};

export function normalizeArticleKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const m = raw.replace(/\s+/g, "").match(/第(\d{1,3})條/);
  if (!m) return null;
  return `第${m[1]}條`;
}

/** 自全文擷取「第N條」提及（函釋常用） */
export function extractMentionedArticles(text: string, limit = 6): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/第\s*(\d{1,3})\s*條/g)) {
    const key = `第${m[1]}條`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(key);
    if (found.length >= limit) break;
  }
  return found;
}

/** 以 Parent／條號節點建構知識圖譜 */
export function buildKnowledgeGraph(chunks: GraphChunkRef[]): KnowledgeGraph {
  const nodes = new Map<string, GraphChunkRef>();
  const byArticle = new Map<string, string[]>();
  const edges: KnowledgeGraphEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const c of chunks) {
    nodes.set(c.id, c);
    const key = normalizeArticleKey(c.articleKey);
    if (key) {
      const list = byArticle.get(key) ?? [];
      list.push(c.id);
      byArticle.set(key, list);
    }
  }

  const addEdge = (
    fromId: string,
    toId: string,
    relation: KnowledgeGraphEdge["relation"],
    articleKey: string,
  ) => {
    if (fromId === toId) return;
    const k = `${fromId}>${toId}>${relation}>${articleKey}`;
    if (edgeSeen.has(k)) return;
    edgeSeen.add(k);
    edges.push({ fromId, toId, relation, articleKey });
  };

  // SAME_ARTICLE：同條號跨法規類型互連
  for (const [articleKey, ids] of byArticle) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i]!, ids[j]!, "SAME_ARTICLE", articleKey);
        addEdge(ids[j]!, ids[i]!, "SAME_ARTICLE", articleKey);
      }
    }
  }

  // MENTIONS_ARTICLE：函釋／辦法正文提及某條 → 連到母法／細則該條
  for (const c of chunks) {
    if (c.tier === "LAW") continue;
    const mentions = extractMentionedArticles(c.content);
    for (const articleKey of mentions) {
      const targets = byArticle.get(articleKey) ?? [];
      for (const tid of targets) {
        if (tid === c.id) continue;
        const t = nodes.get(tid);
        if (!t) continue;
        if (t.tier === "LAW" || t.tier === "REGULATION") {
          addEdge(c.id, tid, "MENTIONS_ARTICLE", articleKey);
          addEdge(tid, c.id, "MENTIONS_ARTICLE", articleKey);
        }
      }
    }
  }

  return { byArticle, nodes, edges };
}

/**
 * 由命中節點擴展關聯：優先 細則 → 函釋，限制數量。
 * 母法命中時拉出同條號施行細則與函釋脈絡。
 */
export function expandGraphNeighbors(
  graph: KnowledgeGraph,
  seedIds: string[],
  opts?: { maxExtra?: number },
): GraphChunkRef[] {
  const maxExtra = opts?.maxExtra ?? 3;
  const out: GraphChunkRef[] = [];
  const seen = new Set(seedIds);
  const tierPriority = (t: string) => {
    if (t === "REGULATION") return 0;
    if (t === "INTERPRETATION") return 1;
    if (t === "ADMIN_RULE") return 2;
    return 3;
  };

  const candidates: GraphChunkRef[] = [];
  for (const sid of seedIds) {
    for (const e of graph.edges) {
      if (e.fromId !== sid) continue;
      if (seen.has(e.toId)) continue;
      const node = graph.nodes.get(e.toId);
      if (!node) continue;
      candidates.push(node);
    }
  }

  candidates.sort((a, b) => tierPriority(a.tier) - tierPriority(b.tier));
  for (const n of candidates) {
    if (out.length >= maxExtra) break;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

/** 說明圖譜擴展來源（給 mode 字串／除錯） */
export function graphExpandModeTag(added: number): string {
  return added > 0 ? "+graphrag" : "";
}
