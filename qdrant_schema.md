# Qdrant Schema Definition

## Collection: `usm_nodes` (User Story Map)
用於存放 User Story Map 的節點資訊，主要用於檢索類似的使用者故事，以對齊需求目標。

**Payload Structure:**
```json
{
  "team_id": 7,
  "team_name": "GED",
  "map_id": 3,
  "map_name": "CBS",
  "node_type": "user_story", // e.g., "user_story", "activity"...
  "level": 3,
  "node_id": "Story-CBS-00306",
  "children_ids": [],
  "related_node_ids": [],
  "title": "調整金額(CN)/注數(VNC)",
  "description": "點擊投注左方的數字, 彈出簡易計算機後修改想要的數字並點擊確認完成修改",
  "as_a": "玩家",
  "i_want": "修改想要投注的金額或注數",
  "so_that": "", // 可能為空字串
  "jira_tickets": [],
  "text": "地圖: CBS\n路徑: ...\n名稱: ...\n描述: ...\n類型: Story\n角色 (As a): ...\n需求 (I want): ...", // Embedding 用的完整文本
  "resource_type": "usm_node",
  "updated_at": "2025-11-25T08:56:28.322380"
}
```

## Collection: `test_cases` (Test Cases)
用於存放詳細的測試案例，包含前置條件、步驟與預期結果。用於生成 BDD 格式的 Acceptance Criteria。

**Payload Structure:**
```json
{
  "team_id": 4,
  "team_name": "GPD",
  "test_case_number": "TCG-118644.010.010",
  "priority": "Medium",
  "set_id": 4,
  "lark_record_id": null,
  "tcg_tickets": ["TCG-118644"],
  "title": "單一遊戲 API 帶入 ext 未生成壓縮圖使用 PNG",
  "precondition": "API路徑：...\n●Merchant：...\nDB路徑：...", // 對應 Given
  "steps": "Step1. ...\nStep2. ...", // 對應 When
  "expected_result": "●request ext 為 webp 使用 PNG 圖...", // 對應 Then
  "text": "標題: ...\n前置條件: ...\n測試步驟: ...\n預期結果: ...", // Embedding 用的完整文本
  "resource_type": "test_case",
  "updated_at": "2025-10-25T12:32:09.245471"
}
```

## Collection: `jira_references` (JIRA References)
用於存放既有 JIRA 議題的摘要與描述，方便檢索相似需求或背景資訊。

**Payload Structure:**
```json
{
  "project_key": "ABC",
  "issue_key": "ABC-1234",
  "issue_type": "Story",
  "team_name": "TAD",
  "component_team": "TAD",
  "summary": "使用者可以在結帳頁輸入折扣碼",
  "description": "當使用者輸入有效折扣碼時，應顯示折扣後價格。",
  "acceptance_criteria": "Given...\nWhen...\nThen...",
  "labels": ["checkout", "discount"],
  "text": "Key: ABC-1234\nSummary: ...\nDescription: ...\nAC: ...", // Embedding 用的完整文本
  "resource_type": "jira_reference",
  "updated_at": "2025-11-25T08:56:28.322380"
}
```
