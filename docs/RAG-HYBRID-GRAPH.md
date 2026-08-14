# RAG 架構：Hybrid Search + Parent-Document Chunking + GraphRAG

生產預設管線（`retrieveForRag`，strategy=`parent_contextual`）：

```text
查詢擴展
  → Hybrid Search（BM25 關鍵字 + Dense Vector 語意，RRF 融合）
  → BGE 風格 Re-rank → MMR
  → Hierarchical／Parent-Document：命中 CHILD，回傳 PARENT 完整條文上下文
  →（可選）GraphRAG 同條號細則／函釋擴展
  → 可追溯引文
```

## 1. Hybrid Search（BM25 + Dense Vector）

| 元件 | 檔案 | 說明 |
|------|------|------|
| BM25 | `src/lib/bm25.ts` | 繁中 n-gram＋條號 token，強化關鍵字／條號精準 |
| Dense Vector | `src/lib/embeddings.ts` | Child 片段 embedding 餘弦相似度 |
| RRF | `reciprocalRankFusion` | 合併 BM25 與向量排序 |
| 加權融合 | `src/lib/rag-hybrid-config.ts` | BM25／語意／RRF 權重可調 |
| Re-rank | `src/lib/rerank.ts` | 本地 BGE 風格；可選遠端 BGE |

`retrievalMode` 範例：`rag-bm25-vector-rrf+hybrid=bm25+vector+rrf+bge-local+strategy=parent_contextual+parent-child+graphrag`

### 環境變數（選填）

```bash
# Hybrid 權重（預設與既有生產行為一致）
RAG_BM25_WEIGHT="0.28"
RAG_SEMANTIC_WEIGHT="0.38"
RAG_KEYWORD_WEIGHT="0.14"
RAG_RRF_BLEND="0.35"          # 最終分 = base*(1-blend) + rrf*blend
RAG_DISABLE_VECTOR="false"    # true 時僅 BM25／關鍵字

RAG_FETCH_K="40"
RAG_TOP_K="8"
RAG_MMR_LAMBDA="0.65"

# 遠端 BGE-Reranker（未設定則用本地）
# BGE_RERANKER_URL=""
# HF_API_TOKEN=""
# BGE_RERANKER_MODEL="BAAI/bge-reranker-v2-m3"
```

## 2. Hierarchical / Parent-Document Chunking

詳見 [`RAG-PARENT-CHILD.md`](./RAG-PARENT-CHILD.md)。

| 層級 | 用途 |
|------|------|
| **CHILD（小切片）** | 僅此層做 BM25／向量檢索，提高命中精準度 |
| **PARENT（條文級）** | 命中後展開完整法條上下文，避免條文被切碎後失去 Context |

- Ingest：`chunkMarkdownParentChild`（`src/lib/chunk-text.ts`）
- Embed：`npm run corpus:embed` **僅對 CHILD** 寫入 embedding
- Retrieve：搜 CHILD → `expandHitsToParentContext` 回 PARENT

## 3. GraphRAG 與可追溯引文

- `src/lib/knowledge-graph.ts`：同條號母法／細則／函釋擴展
- `CitationAnswer`：回答內 `[片段N]` 可點開原文與版本

## 測試

```bash
npx tsx --test src/lib/rag-upgrade.test.ts src/lib/rag-hybrid-config.test.ts
npx tsx --test src/lib/chunk-text.parent-child.test.ts
```
