export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const key1 = process.env.GROQ_API_KEY_1;
  const key2 = process.env.GROQ_API_KEY_2;
  
  if (!key1 && !key2) {
    console.error('No GROQ_API_KEY environment variables are set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { message, city, agent_mode, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const cityToUse = city || 'Unknown Location';
    const modeToUse = agent_mode || 'auto';
    const weatherData = context?.weather_data || {};

    const systemPrompt = `You are WeatherGPT, a highly intelligent weather assistant.
Agent Mode: ${modeToUse}
Location: ${cityToUse}

Current Weather Data from Open-Meteo for ${cityToUse}:
${JSON.stringify(weatherData, null, 2)}

Provide a concise, helpful, and markdown-formatted answer to the user's question based strictly on this data. If the answer is not in the data, state that you don't know.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    const makeRequest = async (apiKey: string) => {
      return await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: messages,
          temperature: 0.2
        })
      });
    };

    let response;
    
    // Attempt 1: Key 1
    if (key1) {
      console.log('Attempting request with groq-key-1');
      response = await makeRequest(key1);
      
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        console.log(`groq-key-1 failed with status ${response.status}, failing over...`);
        response = null; // Force failover
      }
    }
    
    // Attempt 2: Key 2
    if (!response && key2) {
      console.log('Attempting request with groq-key-2');
      response = await makeRequest(key2);
      
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        console.log(`groq-key-2 failed with status ${response.status}`);
      }
    }
    
    if (!response) {
       return res.status(500).json({ error: 'All configured API providers failed.' });
    }

    if (!response.ok) {
       console.error(`Groq API error: ${response.status} ${response.statusText}`);
       return res.status(500).json({ error: 'Error generating response from LLM' });
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({
      reply: replyText,
      city: cityToUse,
      cards: [],
      sources: [{ name: "Groq", source: "LLM" }, { name: "Open-Meteo", source: "API" }],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating chat response:', error);
    return res.status(500).json({ error: 'Error generating response from LLM' });
  }
}
