# RAG 架構升級：Hybrid Search + GraphRAG + 可追溯引文

## 1. Hybrid Search + Re-ranking

檢索管線（`src/lib/rag.ts`）：

1. **BM25**（`src/lib/bm25.ts`）：繁中 n-gram＋條號 token，強化關鍵字／條號精準
2. **Vector Search**：既有 embedding 餘弦相似度
3. **RRF**（Reciprocal Rank Fusion）：合併 BM25 與向量排序
4. **Re-ranker**（`src/lib/rerank.ts`）
   - 預設：**本地 BGE 風格**（語意 + BM25 正規化 + 條號／片語加權）
   - 可選遠端：設定 `BGE_RERANKER_URL`，或 `HF_API_TOKEN` + `BGE_RERANKER_MODEL`（預設 `BAAI/bge-reranker-v2-m3`）
5. **MMR** 多樣性 → Parent-Child 展開

`retrievalMode` 範例：`rag-bm25-vector-rrf+bge-local+parent-child+graphrag`

## 2. GraphRAG（知識圖譜）

`src/lib/knowledge-graph.ts`：

- 以 **條號（articleKey）** 連結母法（LAW）、施行細則（REGULATION）、函釋（INTERPRETATION）
- 邊類型：`SAME_ARTICLE`、`MENTIONS_ARTICLE`
- 命中母法後自動擴展同條號細則／函釋脈絡（最多 +3）

## 3. 100% 可追溯引文（Citation Popover）

- API 回傳每個【片段N】的原文、法規標題、條號、版本／異動日、來源 URL（`src/lib/citations.ts`）
- 前端 `CitationAnswer`：回答內 `[片段N]` 變為可點擊標籤，彈出原文與版本資訊

## 環境變數（選填）

```bash
# 遠端 BGE-Reranker（自架）
BGE_RERANKER_URL="https://your-reranker/rerank"

# 或 Hugging Face Inference
HF_API_TOKEN=""
BGE_RERANKER_MODEL="BAAI/bge-reranker-v2-m3"
```

## 測試

```bash
npx tsx --test src/lib/rag-upgrade.test.ts
```
