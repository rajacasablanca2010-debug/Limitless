export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { imageBase64, prompt } = body;

    if (!imageBase64 || !prompt) {
      return new Response(JSON.stringify({ error: "Missing imageBase64 or prompt" }), { status: 400 });
    }

    // Try env var or hardcoded for testing just in case the user forgets
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server missing GEMINI_API_KEY configuration. Set it in Cloudflare." }), { status: 500 });
    }

    // Using gemini-2.0-flash to avoid limit: 0 issues on preview/experimental models
    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const mimeType = imageBase64.startsWith('/') ? 'image/jpeg' : 
                     imageBase64.startsWith('iVB') ? 'image/png' : 'image/jpeg';

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64
            }
          }
        ]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok || data.error) {
       return new Response(JSON.stringify({ error: data.error }), { 
         status: response.status || 500, 
         headers: { 'Content-Type': 'application/json' }
       });
    }
    
    return new Response(JSON.stringify(data), { 
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
