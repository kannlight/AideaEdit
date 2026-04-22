# AideaEdit (アイディアエディット)

AideaEditは、断片的な思考のメモを追加していくだけで、文章が構成されるAIライティング支援ツールです。

## コンセプト

AideaEditは以下のステップで文章執筆作業をサポートします：

1.  **メモを残す (Memo Timeline)**: 思いついたことを順不同で書き留めます。「構成に加えたい」「構成から外したい」ことを思いついた順に加えていくことができます。
2.  **構成案を練る (Structure Draft)**: AIがメモを解析し、最適な章立てや構成案を提案します。文章を作成する前にAIと認識をすり合わせることができます。変更点はDiffで可視化され、元に戻す、リライト、直接編集も可能です。
3.  **執筆する (Final Prose)**: 固まった構成案を元に、AIが本文（Markdown/Text/LaTeX）を生成します。直接編集も可能です。

## 主な機能

-   **リアルタイム構成提案**: メモを追加するたびに、AIが構成案を更新・洗練させます。
-   **文章生成**: 固まった構成案を元に、AIが本文（Markdown/Text/LaTeX）を生成します。

## デモ動画

https://drive.google.com/file/d/1Ww-0LzX6VavtCUTNAFj1NaAyrlGxNfQY/view?usp=sharing

## 技術スタック

### Frontend
-   [React](https://react.dev/) + [Vite](https://vitejs.dev/)
-   [Tailwind CSS](https://tailwindcss.com/) (Styling)
-   [Zustand](https://github.com/pmndrs/zustand) (State Management)
-   [Lucide React](https://lucide.dev/) (Icons)
-   [react-markdown](https://github.com/remarkjs/react-markdown)

### Backend
-   [FastAPI](https://fastapi.tiangolo.com/) (Python)
-   [Google GenAI SDK](https://ai.google.dev/) (Gemini 2.5 Flash) または Ollama (OpenAI互換エンドポイント経由)

## セットアップ手順

### 前提条件
-   Node.js (v18以上推奨)
-   Python (v3.10以上推奨)
-   以下のいずれか（または両方）:
    -   Google AI Studio API Key（Gemini利用時）
    -   [Ollama](https://ollama.com/) がインストール済みで、使用するモデルがダウンロード済みであること

### 1. バックエンドの起動

```bash
# 仮想環境の作成と有効化 (任意)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 依存関係のインストール
pip install -r backend/requirements.txt

# 環境変数の設定
cp .env.example .env

# .env を編集して、使用するLLMサービスを設定してください（後述）

# サーバー起動 (http://localhost:8000)
python backend/main.py
```

#### LLMサービスの設定

`.env` ファイルを開き、利用するサービスに合わせて設定します。GeminiとOllamaは同時に有効化でき、UIから切り替えて使用できます。

**Gemini を使う場合**

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash  # 省略時のデフォルト
```

**Ollama を使う場合**

`OLLAMA_SERVICES` に `表示名|ベースURL|モデル名` の形式で記載します。カンマ区切りで複数のサービスを登録できます。

```env
# ローカルのOllamaを1つ使う場合
OLLAMA_SERVICES=Ollama Local|http://localhost:11434|qwen3:8b

# 複数のOllamaサーバーを登録する場合
OLLAMA_SERVICES=GPU-A|http://gpu-a:11434|qwen3:8b,GPU-B|http://gpu-b:11435|llama3.1:8b
```

Ollamaのデフォルトポートは `11434` です。使用するモデルが事前にダウンロードされていることを確認してください。

```bash
# モデルのダウンロード例
ollama pull qwen3:8b
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
