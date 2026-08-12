# Parent-Document Chunking 與 Contextual RAG

## 目標

針對法規／函釋資料庫採**雙層切片**：

| 層級 | 用途 |
|------|------|
| **Child（小切片）** | 向量＋關鍵字搜尋，提高命中精準度（Recall／Precision） |
| **Parent（粗切片）** | 搜尋命中後，將「該條文完整上下文」餵給模型 |

另做輕量 **Contextual RAG**：

- Child 寫入前加上法規名／條號前綴再 embedding
- 母法（`government-procurement-act`）命中時，嘗試附上施行細則（`gpa-enforcement-rules`）中提及同條號的 Parent

## 資料模型（`DocChunk`）

- `chunkRole`：`PARENT`｜`CHILD`
- `parentId`：CHILD → PARENT
- `articleKey`：如 `第 48 條`
- `embedding`：僅 CHILD 寫入

正式區若尚未 `db:push`，`ensureDocChunkHierarchySchema()` 會幂等補欄位；知識庫若仍為扁平切片，`ensureKnowledgeBase()` 會自動重跑 ingest 升級。

## 操作

管理者後台「載入／更新知識庫」，或：

```bash
npm run db:push
npm run db:generate
npm run corpus:ingest
```

檢索 mode 字串會帶策略標籤，例如：

- `+strategy=baseline`
- `+strategy=contextual`
- `+strategy=parent_contextual+parent-child`（可再加 `+graphrag`）

三策略比較實驗見 [`docs/RAG-COMPARE.md`](./RAG-COMPARE.md)。
