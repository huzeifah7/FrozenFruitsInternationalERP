const fs = require('fs');
const readline = require('readline');

const path = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\1b2ea5b1-176a-4a55-8020-3cc9e15107dc\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(path),
  output: process.stdout,
  terminal: false
});

const lines = [];
rl.on('line', (line) => {
  lines.push(line);
});

rl.on('close', () => {
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      // Look for step types or tool calls related to browser subagent
      if (parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'browser_subagent' || tc.ToolName === 'browser_subagent') {
            console.log("Subagent task call:", tc.arguments || tc.Arguments);
          }
        }
      }
      // If we see browser outputs or messages containing information
      if (parsed.content && (parsed.content.includes("screenshot") || parsed.content.includes("Click") || parsed.content.includes("click"))) {
        console.log("Message:", parsed.content.substring(0, 500));
      }
    } catch (e) {
      // ignore
    }
  }
});
