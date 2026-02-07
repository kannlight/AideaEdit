from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import json
import re
from services.deps import llm_service

router = APIRouter()

# --- Models ---

class Memo(BaseModel):
    content: str
    type: str  # 'add' or 'remove'

class StructureUpdateRequest(BaseModel):
    current_structure: str
    new_memo: Memo

class ProseGenerateRequest(BaseModel):
    structure: str
    format: str = "Plain"  # Plain, Markdown, LaTeX

class ProseRefineRequest(BaseModel):
    full_text: str
    instruction: str
    selected_start: int = 0
    selected_end: int = 0

# --- Prompts ---

STRUCTURE_ADD_SYSTEM_PROMPT = """あなたは執筆アシスタントです。
ユーザーが入力した「メモ（思考の断片）」を、Markdown形式の「構成案（箇条書き）」に加えます。

## ルール:
1. 現在の構成案をベースに、新しいメモの内容を論理的かつ自然に組み込んでください。
2. 与えられるメモは執筆する文章の一部分に過ぎません。
3. 構成案を完成させる必要はありません。メモに書いていない内容を勝手に追加しないでください。
4. 出力はMarkdownの箇条書きのみとしてください。
"""

STRUCTURE_REMOVE_SYSTEM_PROMPT = """あなたは執筆アシスタントです。
ユーザーの「削除指示（メモ）」を受けて、Markdown形式の「構成案（箇条書き）」を更新・提案してください。

## ルール:
1. 現在の構成案から、指定されたメモの内容に該当する部分を適切に削除・整理してください。
2. 削除によって論理構成が不自然になる場合は、全体を更新しても構いません。
3. 出力はMarkdownの箇条書きのみとしてください。
"""

PROSE_GENERATE_SYSTEM_PROMPT = """あなたはプロのライターです。
提供された「構成案」の内容と順序を厳守し、指定されたフォーマットで文章を執筆してください。

## ルール:
1. 構成案にない内容を勝手に追加しないでください。
2. 指定されたフォーマット（Markdown/Plain/LaTeX）に従ってください。
3. 執筆した文章のみを出力してください。前後に余計な説明を付け加えないでください。
"""

PROSE_REFINE_SYSTEM_PROMPT = """あなたは推敲アシスタントです。
ユーザーからの修正指示に基づき、文章を改善してください。

## ルール:
1. 提供された文章には、修正対象範囲が <target>...</target> タグで囲まれています。
2. 指示に従って <target> タグの中身を修正しつつ、「文章全体」を再度出力してください。
3. 出力時には必ず <target> タグを省略せず、修正した箇所を囲んだままにしてください。
4. 修正した「文章全体」のみを出力してください。前後に余計な説明を付け加えないでください。
"""

# --- Endpoints ---

@router.post("/structure/update")
async def update_structure(request: StructureUpdateRequest, req: Request):
    memo = request.new_memo
    
    if memo.type == 'remove':
        system_prompt = STRUCTURE_REMOVE_SYSTEM_PROMPT
        memo_display = f"削除対象のメモ: {memo.content}"
    else:
        system_prompt = STRUCTURE_ADD_SYSTEM_PROMPT
        memo_display = f"追加するメモ: {memo.content}"

    user_prompt = f"現在の構成案:\n{request.current_structure}\n\n{memo_display}\n\nこれらを踏まえた新しい構成案を作成してください。"

    async def event_generator():
        async for chunk in llm_service.generate_stream(system_prompt, user_prompt):
            if await req.is_disconnected():
                break
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/prose/generate")
async def generate_prose(request: ProseGenerateRequest, req: Request):
    user_prompt = f"フォーマット: {request.format}\n\n構成案:\n{request.structure}\n\nこれに基づき文章を執筆してください。"

    async def event_generator():
        async for chunk in llm_service.generate_stream(PROSE_GENERATE_SYSTEM_PROMPT, user_prompt):
            if await req.is_disconnected():
                break
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/prose/refine")
async def refine_prose(request: ProseRefineRequest):    
    # 選択範囲をタグで囲む
    start = request.selected_start
    end = request.selected_end
    
    if start == 0 and end == 0:
        tagged_text = f"<target>{request.full_text}</target>"
    else:
        tagged_text = (
            request.full_text[:start] + 
            "<target>" + request.full_text[start:end] + "</target>" + 
            request.full_text[end:]
        )
    
    user_prompt = f"文章:\n{tagged_text}\n\n指示: {request.instruction}"
    
    # 最大3回リトライ
    max_retries = 3
    refined_part = None
    
    for i in range(max_retries):
        llm_output = await llm_service.generate_sync(PROSE_REFINE_SYSTEM_PROMPT, user_prompt)
        
        match = re.search(r'<target>(.*?)</target>', llm_output, re.DOTALL)
        if match:
            refined_part = match.group(1).strip()
            break
        else:
            print(f"Retry {i+1}: <target> tag not found in LLM output.")
            continue
    
    if refined_part is not None:
        if start == 0 and end == 0:
            final_text = refined_part
        else:
            final_text = request.full_text[:start] + refined_part + request.full_text[end:]
        return {"refined_content": final_text}
    else:
        raise HTTPException(
            status_code=422, 
            detail="AIの出力に不備（タグの欠落）がありました。もう一度お試しいただくか、指示内容を調整してください。"
        )
