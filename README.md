# AideaEdit (アイディアエディット)

AideaEditは、断片的な思考のメモを追加していくだけで、文章が構成されるAIライティング支援ツールです。

![UI Preview](file:///home/kanno/.gemini/antigravity/brain/00361370-2ea8-4075-98e7-ddeadd62fe3d/light_mode_initial_1770556949419.png)

## コンセプト

AideaEditは以下のステップで文章執筆作業をサポートします：

1.  **メモを残す (Memo Timeline)**: 思いついたことを順不同で書き留めます。「構成に加えたい」「構成から外したい」ことを思いついた順に加えていくことができます。
2.  **構成案を練る (Structure Draft)**: AIがメモを解析し、最適な章立てや構成案を提案します。文章を作成する前にAIと認識をすり合わせることができます。変更点はDiffで可視化され、元に戻す、リライト、直接編集も可能です。
3.  **執筆する (Final Prose)**: 固まった構成案を元に、AIが本文（Markdown/Text/LaTeX）を生成します。直接編集も可能です。

## 主な機能

-   **リアルタイム構成提案**: メモを追加するたびに、AIが構成案を更新・洗練させます。
-   **文章生成**: 固まった構成案を元に、AIが本文（Markdown/Text/LaTeX）を生成します。

## 技術スタック

### Frontend
-   [React](https://react.dev/) + [Vite](https://vitejs.dev/)
-   [Tailwind CSS](https://tailwindcss.com/) (Styling)
-   [Zustand](https://github.com/pmndrs/zustand) (State Management)
-   [Lucide React](https://lucide.dev/) (Icons)
-   [react-markdown](https://github.com/remarkjs/react-markdown)

### Backend
-   [FastAPI](https://fastapi.tiangolo.com/) (Python)
-   [Google GenAI SDK](https://ai.google.dev/) (Gemini 2.5 Flash)

## セットアップ手順

### 前提条件
-   Node.js (v18以上推奨)
-   Python (v3.10以上推奨)
-   Google AI Studio API Key

### 1. バックエンドの起動

```bash
# 仮想環境の作成と有効化 (任意)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 依存関係のインストール
pip install -r requirements.txt

# 環境変数の設定
# .env.example をコピーして .env を作成し、GEMINI_API_KEY を設定してください
cp .env.example .env

# サーバー起動 (http://localhost:8000)
python backend/main.py
```

### 2. フロントエンドの起動

```bash
cd frontend

# 依存関係のインストール
npm install

# 開発サーバー起動 (http://localhost:3000)
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスしてください。
