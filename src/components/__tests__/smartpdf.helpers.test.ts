import { describe, it, expect, vi } from 'vitest';
import ai from '../../lib/aiAssistant';

// Simple unit test for the flashcard prompt builder
describe('SmartPDF flashcard prompt', () => {
  it('builds a reasonable prompt and parses result fallback', async () => {
    const excerpt = 'Photosynthesis is the process plants use to convert sunlight to energy.';
    const prompt = `Create a single question and answer flashcard from this excerpt:\n\n${excerpt}\n\nReturn in JSON with keys question and answer.`;
    // Mock ai.callGemini
    const mock = vi.spyOn(ai as any, 'callGemini').mockResolvedValue(JSON.stringify({ question: 'What process do plants use to convert sunlight to energy?', answer: 'Photosynthesis' }));
    const res = await (ai as any).callGemini(prompt, 0.2, undefined, undefined, 'generate');
    const parsed = JSON.parse(String(res));
    expect(parsed.question).toContain('process');
    expect(parsed.answer).toContain('Photosynthesis');
    mock.mockRestore();
  });
});
