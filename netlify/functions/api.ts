import express, { Router } from 'express';
import serverless from 'serverless-http';

const app = express();
const router = Router();

app.use(express.json());

// Retell API endpoint to create a web call
router.post('/create-web-call', async (req, res) => {
  try {
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'RETELL_API_KEY is not set' });
    }

    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: 'agent_8200db34622ed2489557a51a4a',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error creating web call:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/.netlify/functions/api', router);

export const handler = serverless(app);
