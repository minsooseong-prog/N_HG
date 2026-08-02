# 헬스 기구 챗봇 (Vercel 버전)

Google Apps Script(Code.gs + Sidebar.html)로 만들었던 헬스 기구 인식 챗봇을
Vercel에서 바로 배포 가능한 구조로 이식한 버전입니다.

## 원본 대비 달라진 점

| Apps Script (원본) | Vercel 버전 |
|---|---|
| `Code.gs`의 `analyzeEquipment()` | `api/analyze.js` (서버리스 함수) |
| `Code.gs`의 `askFollowUp()` | `api/chat.js` (서버리스 함수) |
| Google Drive 파일 ID로 데이터셋 로드 | `data/exercises_slim.json` (레포에 정적 파일로 포함) |
| `PropertiesService`의 `GEMINI_API_KEY` | Vercel Environment Variable `GEMINI_API_KEY` |
| `Sidebar.html` + `google.script.run` | `public/index.html` + `fetch('/api/...')` |
| `CacheService` (6시간 캐시) | 서버리스 함수 warm 인스턴스 내 메모리 캐시 (콜드 스타트 시 초기화됨 — 정상 동작) |

로직(프롬프트, JSON 스키마, 관련 운동 매칭 방식 등)은 원본과 동일하게 유지했습니다.

## 폴더 구조

```
.
├── api/
│   ├── _lib.js       # 데이터셋 로드 + Gemini 호출 공통 함수
│   ├── analyze.js     # POST /api/analyze  (사진 분석)
│   └── chat.js         # POST /api/chat     (후속 질문)
├── data/
│   └── exercises_slim.json   # 운동 데이터셋 (교체 필요, 아래 참고)
├── public/
│   └── index.html      # 프론트엔드
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

## 1. 데이터셋 파일 교체 (중요)

`data/exercises_slim.json`은 예시 1개 항목만 들어있는 placeholder입니다.
아래 방법 중 하나로 실제 데이터를 넣으세요.

**방법 A (권장): 기존 Apps Script 프로젝트에서 그대로 내보내기**
1. 기존 Apps Script 프로젝트에서 `buildSlimDataset()`을 실행하면 Drive에
   `exercises_slim.json`이 생성됩니다.
2. 그 파일을 다운로드해서 이 프로젝트의 `data/exercises_slim.json`으로 덮어쓰세요.

**방법 B: 원본 대용량 데이터셋 파일을 직접 변환**
원본 JSON을 아래 필드만 남기고 이 경로에 저장하면 됩니다.
```json
[
  {
    "id": "...",
    "name": "...",
    "equipment": "cable",
    "target": "lats",
    "muscle_group": "back",
    "secondary_muscles": ["biceps"],
    "body_part": "back",
    "category": "strength"
  }
]
```

**방법 C: Drive 파일을 계속 그대로 쓰고 싶다면**
`api/_lib.js` 안에 주석 처리된 `loadDatasetFromDrive()` 함수를 참고하세요.
Drive 파일을 "링크가 있는 모든 사용자 - 뷰어"로 공유 설정한 뒤,
`loadDataset` 대신 이 함수를 `analyze.js`에서 import해서 쓰면 됩니다.
(단, 파일이 클수록 매 요청 콜드 스타트마다 다운로드 시간이 늘어납니다.
방법 A/B로 레포에 번들하는 쪽이 더 빠르고 안정적입니다.)

## 2. GitHub 업로드

```bash
cd gym-equipment-chatbot
git init
git add .
git commit -m "Initial commit: 헬스 기구 챗봇 Vercel 버전"
git branch -M main
git remote add origin https://github.com/<your-id>/<repo-name>.git
git push -u origin main
```

## 3. Vercel 배포

1. [vercel.com](https://vercel.com) 에 로그인 후 "Add New... > Project"
2. 방금 만든 GitHub 레포 선택 후 Import
3. Framework Preset은 "Other"로 두면 됩니다 (자동 감지됨)
4. **Environment Variables**에 아래 값 추가
   - `GEMINI_API_KEY` : Gemini API 키 ([발급 링크](https://aistudio.google.com/apikey))
   - `GEMINI_MODEL` (선택) : 기본값 `gemini-2.5-flash`
5. Deploy 클릭

배포가 끝나면 `https://<프로젝트명>.vercel.app` 에서 바로 사용 가능합니다.

## 4. 로컬에서 테스트하기

```bash
npm install -g vercel   # 최초 1회
cd gym-equipment-chatbot
vercel dev
```
`http://localhost:3000` 접속. 로컬 실행 시 `.env` 파일을 만들어
`.env.example`처럼 `GEMINI_API_KEY`를 채워두면 자동으로 로드됩니다.

## 참고: 이미지 업로드 크기 제한

Vercel 서버리스 함수는 요청 본문 크기가 기본적으로 약 4.5MB로 제한됩니다.
고화질 사진을 base64로 보내면 이 한도를 넘을 수 있으니, 필요하다면
프론트엔드에서 업로드 전 이미지 리사이즈/압축(예: `<canvas>`로 1280px 정도로
축소 후 JPEG 재인코딩)을 추가하는 것을 권장합니다.
