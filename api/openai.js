/**
 * Vercel Serverless Function: OpenAI APIプロキシ
 * ブラウザからのCORS回避用
 */
module.exports = async (req, res) => {
    const path = req.query.path || 'v1/chat/completions';

    const url = `https://api.openai.com/${path}`;

    const headers = {
        'Content-Type': 'application/json',
    };

    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    }

    try {
        const fetchResponse = await fetch(url, {
            method: req.method || 'POST',
            headers: headers,
            body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
        });

        const isStream = req.body && req.body.stream;

        if (isStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');

            const reader = fetchResponse.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value, { stream: true }));
            }
            res.end();
        } else {
            const data = await fetchResponse.json();
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(fetchResponse.status).json(data);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
