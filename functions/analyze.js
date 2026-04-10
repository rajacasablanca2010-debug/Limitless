export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { imageBase64, prompt } = body;

    if (!imageBase64 || !prompt) {
      return new Response(JSON.stringify({ error: "Missing imageBase64 or prompt" }), { status: 400 });
    }

    const mimeType = imageBase64.startsWith('/') ? 'image/jpeg' : 
                     imageBase64.startsWith('iVB') ? 'image/png' : 'image/jpeg';

    // Cloudflare AI run call for Llama Vision
    const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image_url", 
              image_url: { url: `data:${mimeType};base64,${imageBase64}` } 
            }
          ]
        }
      ]
    });

    // Mock Gemini API json response structure so frontend doesn't break at all
    const mockGeminiResponse = {
      candidates: [{ 
         content: { 
           parts: [{ text: response.response }] 
         } 
      }]
    };
    
    return new Response(JSON.stringify(mockGeminiResponse), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
