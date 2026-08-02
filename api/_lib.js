/*************************************************************
 * 공통 유틸: 데이터셋 로드 + Gemini API 호출
 *
 * Apps Script 버전의 Code.gs 에 있던
 *   loadDataset / normalizeEntry / getEquipmentTypes /
 *   findRelatedExercises / callGemini / safeParseJson
 * 를 그대로 옮긴 것입니다.
 *************************************************************/

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function geminiEndpoint() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Vercel 프로젝트 설정 > Environment Variables 에서 등록하세요.');
  }
  return (
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL +
    ':generateContent?key=' +
    GEMINI_API_KEY
  );
}

// ===== 데이터셋 로드 ============================================
// 원본(Apps Script)은 Google Drive 파일 ID로 읽었지만,
// Vercel 서버리스 환경에는 사용자 Drive 권한(OAuth)이 없으므로
// 레포에 정적 JSON 파일로 번들해서 씁니다.
//   -> data/exercises_slim.json 을 프로젝트에 커밋하세요.
//      (Apps Script의 buildSlimDataset() 으로 만든 경량 파일을 그대로 사용 가능)
//
// 만약 Drive에 있는 파일을 계속 쓰고 싶다면, 파일을 "링크가 있는 모든 사용자에게 공개"로
// 전환한 뒤 아래 loadDatasetFromDrive() 를 대신 사용하세요 (하단 주석 참고).

let _datasetMemo = null; // 같은 warm 인스턴스 안에서는 재사용

export async function loadDataset() {
  if (_datasetMemo) return _datasetMemo;

  const filePath = path.join(__dirname, '..', 'data', 'exercises_slim.json');
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  const list = Array.isArray(data) ? data : (data.exercises || data.data || []);

  _datasetMemo = list;
  return list;
}

/*
// ---- Drive 공개 파일을 그대로 쓰고 싶은 경우 (대안) ----
// 1) Drive에서 파일 우클릭 > 공유 > "링크가 있는 모든 사용자" > 뷰어
// 2) 아래 함수로 교체해서 사용
const DATASET_FILE_ID = '1T9USw4ZfIj4a9N2FUDJapwoldM6GmIKH';
export async function loadDatasetFromDrive() {
  if (_datasetMemo) return _datasetMemo;
  const url = `https://drive.google.com/uc?export=download&id=${DATASET_FILE_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Drive 데이터셋 다운로드 실패: ' + res.status);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.exercises || data.data || []);
  _datasetMemo = list;
  return list;
}
*/

export function normalizeEntry(e) {
  return {
    name: e.name || '',
    equipment: e.equipment || '',
    target: e.target || e.muscle_group || '',
    secondary: e.secondary_muscles || [],
    instructions: (e.instruction_steps && e.instruction_steps.en) || []
  };
}

export async function getEquipmentTypes() {
  const list = await loadDataset();
  const set = {};
  list.forEach((e) => {
    const eq = normalizeEntry(e).equipment;
    if (eq) set[String(eq).toLowerCase().trim()] = true;
  });
  return Object.keys(set);
}

export async function findRelatedExercises(matchedEquipment) {
  if (!matchedEquipment) return [];
  const target = String(matchedEquipment).toLowerCase().trim();
  const list = await loadDataset();
  const out = [];
  for (let i = 0; i < list.length && out.length < 6; i++) {
    const e = normalizeEntry(list[i]);
    if (String(e.equipment).toLowerCase().trim() === target) {
      out.push({ name: e.name, target: e.target });
    }
  }
  return out;
}

// ===== Gemini 호출 ==============================================
export async function callGemini(payload) {
  const res = await fetch(geminiEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini API 오류 (${res.status}): ${text}`);
  }
  const data = JSON.parse(text);
  if (!data.candidates || !data.candidates.length) {
    throw new Error('Gemini 응답에 결과가 없습니다: ' + text);
  }
  const parts = data.candidates[0].content.parts || [];
  return parts.map((p) => p.text || '').join('');
}

export function safeParseJson(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(s);
  } catch (e) {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('JSON 파싱 실패: ' + raw);
  }
}
