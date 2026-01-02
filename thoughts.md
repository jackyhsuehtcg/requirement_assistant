形式：Chrome Extension

描述：
1. 使用者開啟 JIRA 頁面
2. 建立 issue 或是修改 issue 的 description 時
3. description 框內會有浮動按鈕
4. 按下去後，會根據使用者輸入的內容做建議以及潤飾
5. 會有 preview 視窗可以讓使用者修改後繼續請 LLM 潤飾，或是直接接受並填入description

目標環境：
- JIRA Server (v9.12.24#9120024-sha1:c03a9d7)
- 需針對此版本的 DOM 結構設計偵測與插入邏輯

後端架構 (Python)：
- API Server：處理前端請求，串接 LLM 與向量資料庫。
- 向量資料庫 (Qdrant)：
  - 內容：User Story Map (以 BDD 格式簡述需求)、Test Case 資料庫。
  - 設定：Server 位置與連線資訊需透過後端設定檔 (Configuration File) 指定，不可寫死。
- RAG 策略：根據使用者輸入的關鍵字或片段，檢索相關的 BDD Story 與 Test Cases，用於補強需求的完整性。
- LLM 設定：
  - Provider: OpenRouter
  - Model: Grok 4 Fast
  - Auth: API Key 由 Server 端統一管理 (.env)
  - Parameters: Low Temperature (e.g., 0.1) 以確保精準度與可重現性。

輸出格式要求 (Standardization)：
LLM 產出的 Description 必須包含以下區塊：
1. User Story (As a..., I want..., So that...)
2. Acceptance Criteria (需參考檢索到的 Test Cases，以 BDD/Gherkin 或條列式呈現)
3. Technical Specifications (API 欄位、錯誤處理、技術限制等)

前端互動 (UX)：
- 預覽視窗 (Preview Modal)：
  - 顯示 LLM 生成的結果。
  - 使用者可「直接編輯」文字內容 (Text Editor)。
  - 確認無誤後，一鍵填入 JIRA Description 欄位。
  - UI 設計需美觀簡潔，避免過度複雜的 JS 邏輯。

開發注意事項：
- 需設計 Prompt template 以確保輸出格式穩定。
- 需定義前後端 API 介面。
