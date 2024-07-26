const express = require('express');
const app = express();
const { OpenAI } = require('openai');
const { google } = require('googleapis');
const axios = require('axios');
const cheerio = require('cheerio');

const HF_TOKEN = "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";
const openai = new OpenAI({
  baseUrl: 'https://api-inference.huggingface.co/v1/',
  apiKey: HF_TOKEN,
});

async function respond(message, maxTokens = 512, temperature = 0.7, topP = 0.95) {
  const messages = [message];
  let response = '';
  for await (const message of openai.chat.completions.create({
    model: 'mistralai/Mistral-Nemo-Instruct-2407',
    maxTokens,
    stream: true,
    temperature,
    topP,
    messages,
  })) {
    const token = message.choices[0].delta.content;
    response += token;
    yield response;
  }
}

async function googleSearch(query, numResults = 5) {
  const searchResults = [];
  const g = `give me a google prompt for this : ${query}`;
  const prompt = respond({ role: 'user', content: g });
  const urls = await google.search(query, numResults);
  for (const url of urls) {
    searchResults.push(url);
  }
  return searchResults;
}

async function fetchAndSummarizeUrl(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const text = $('p').text().trim();
    return text.slice(0, 10000);
  } catch (error) {
    return null;
  }
}

async function run(input) {
  const searchResults = await googleSearch(input);
  const texts = [];
  for (const url of searchResults) {
    const text = await fetchAndSummarizeUrl(url);
    if (text) {
      texts.push(text);
    }
  }
  const textsJoined = texts.join(' ');
  const summaryPrompt = `Summarize the following content: ${textsJoined}`;
  const summary = (await respond({ role: 'user', content: summaryPrompt })).slice(-1)[0];
  return summary;
}

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.get('/200', (req, res) => {
  res.send('OK');
});

app.get('/ask', (req, res) => {
  const query = req.query.query;
  async function generate() {
    const result = await run(query);
    yield result;
  }
  res.set("Content-Type", "text/plain");
  generate().next().value.then((result) => res.send(result));
});

app.post('/asklong', (req, res) => {
  const query = req.body.toString('utf-8');
  async function generate() {
    const result = await run(query);
    yield result;
  }
  res.set("Content-Type", "text/plain");
  generate().next().value.then((result) => res.send(result));
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});