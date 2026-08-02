/*************************************************************
 * POST /api/analyze
 * body: { image: "<base64, 접두어 없음>", mimeType: "image/jpeg" }
 *
 * Apps Script의 analyzeEquipment() 를 그대로 옮긴 엔드포인트.
 *************************************************************/
import {
  getEquipmentTypes,
  findRelatedExercises,
  callGemini,
  safeParseJson
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  try {
    const { image, mimeType } = req.body || {};
    if (!image || !mimeType) {
      return res.status(400).json({ error: 'image, mimeType 값이 필요합니다.' });
    }

    const equipmentTypes = await getEquipmentTypes();

    const prompt =
      '당신은 헬스 트레이닝 전문가입니다. 첨부된 사진 속 헬스 기구를 식별하고, ' +
      '한국 헬스장 이용자를 위해 한국어로 정보를 정리하세요.\n\n' +
      '아래 "장비 분류 목록"은 데이터셋에 존재하는 영어 장비 종류입니다. ' +
      'matchedEquipment 필드에는 이 목록 중 사진과 가장 잘 맞는 값 하나를 그대로 적으세요. ' +
      '적절한 값이 없으면 빈 문자열로 두세요.\n' +
      '장비 분류 목록: ' + JSON.stringify(equipmentTypes) + '\n\n' +
      '반드시 아래 JSON 형식 하나만 출력하세요 (다른 텍스트, 마크다운 금지):\n' +
      '{\n' +
      '  "equipmentNameKo": "기구의 한국어 이름",\n' +
      '  "equipmentNameEn": "기구의 영어 이름",\n' +
      '  "matchedEquipment": "장비 분류 목록 중 택1 또는 빈 문자열",\n' +
      '  "description": "기구에 대한 2~3문장 설명",\n' +
      '  "usage": ["사용 방법을 단계별로 3~6개"],\n' +
      '  "targetMuscles": ["주로 자극되는 부위들"],\n' +
      '  "cautions": ["부상 예방 등 주의할 점 2~4개"],\n' +
      '  "confidence": "high | medium | low (식별 확신도)"\n' +
      '}\n' +
      '사진에 헬스 기구가 없거나 식별이 어려우면 confidence를 low로 하고 ' +
      'description에 그 사실을 적으세요.';

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: image } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    const raw = await callGemini(payload);
    const result = safeParseJson(raw);

    result.relatedExercises = await findRelatedExercises(result.matchedEquipment);

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || '서버 오류가 발생했습니다.' });
  }
}
