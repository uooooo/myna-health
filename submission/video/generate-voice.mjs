import { readFile, writeFile } from 'node:fs/promises';

const env = await readFile(new URL('.env', import.meta.url), 'utf8');
const key = env.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1];
if (!key) throw new Error('OPENROUTER_API_KEY is missing');
const input = (await readFile(new URL('narration.txt', import.meta.url), 'utf8')).trim();
const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'google/gemini-3.8-flash-lite-tts',
    input,
    voice: 'Kore',
    response_format: 'pcm',
    provider: { options: { 'google-ai-studio': { speech_metadata: { style: 'clear, confident technology presentation' } } } },
  }),
});
if (!response.ok) throw new Error(`TTS failed: ${response.status} ${(await response.text()).slice(0,500)}`);
const audio = Buffer.from(await response.arrayBuffer());
await writeFile(new URL('voice.pcm', import.meta.url), audio);
console.log(`Generated ${audio.length} bytes of speech`);
