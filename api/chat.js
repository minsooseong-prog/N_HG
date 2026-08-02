/*************************************************************
 * POST /api/chat
 * body: {
 *   question: "질문 텍스트",
 *   equipmentInfo: { ...analyze 결과 객체... },
 *   history: [{ role: 'user'|'model', text: '...' }, ...]
 * }
 *
 * Apps Script의 askFollowUp() 을 그대로 옮긴 엔드포인트.
 *************************************************************/
import { callGemini } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  try {
    const { question, equipmentInfo, history } = req.body || {};
    if (!question || !equipmentInfo) {
      return res.status(400).json({ error: 'question, equipmentInfo 값이 필요합니다.' });
    }

    const systemContext =
      '당신은 친절한 헬스 트레이닝 코치입니다. 사용자가 다음 기구에 대해 질문합니다. ' +
      '한국어로 간결하고 정확하게 답하세요. 자세나 안전이 걱정되는 부분은 ' +
      '"정확한 자세는 전문 트레이너에게 확인하세요"라고 안내하세요.\n\n' +
      '대상 기구 정보:\n' + JSON.stringify(equipmentInfo, null, 2);

    const contents = [];
    contents.push({ role: 'user', parts: [{ text: systemContext }] });
    contents.push({ role: 'model', parts: [{ text: '네, 이 기구에 대해 무엇이든 물어보세요.' }] });

    (history || []).forEach((h) => {
      contents.push({ role: h.role, parts: [{ text: h.text }] });
    });
    contents.push({ role: 'user', parts: [{ text: question }] });

    const answer = await callGemini({ contents });

    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || '서버 오류가 발생했습니다.' });
  }
}
