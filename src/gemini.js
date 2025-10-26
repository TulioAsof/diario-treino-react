export async function generateContent(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Erro ao chamar Gemini API');
    const result = await response.json();
    // Gemini retorna o texto em result.candidates[0].content.parts[0].text
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}