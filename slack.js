const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLAMINE_CHANNEL_ID = process.env.SLAMINE_CHANNEL_ID;

const INTERVAL = 60 * 1000;

function checkEnvironment() {
  if (!SLACK_TOKEN) {
    throw new Error("SLACK_TOKEN is not set");
  }

  if (!SLAMINE_CHANNEL_ID) {
    throw new Error("SLAMINE_CHANNEL_ID is not set");
  }
}

async function slackApi(method, params = {}) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

async function postMessage(text, threadTs = null) {
  const params = {
    channel: SLAMINE_CHANNEL_ID,
    text,
  };

  if (threadTs !== null) {
    params.thread_ts = threadTs;
  }

  const data = await slackApi("chat.postMessage", params);

  return data.ts;
}

function formatUsage() {
  return [
    "使い方:",
    "[行] [列] [行動]",
    "",
    "行・列: 0 ~ mapの列数",
    "行動:",
    "f: 旗を置く",
    "o: マスを開く",
    "",
    "例:",
    "2 1 f",
  ].join("\n");
}

function parseInput(text, width, height) {
  const match = text.trim().match(/^(\d+)\s+(\d+)\s+([fo])$/i);

  if (!match) {
    return null;
  }

  const row = Number(match[1]);
  const column = Number(match[2]);
  const action = match[3].toLowerCase();

  if (
    row < 0 ||
    row >= height ||
    column < 0 ||
    column >= width
  ) {
    return null;
  }

  return {
    row,
    column,
    action,
  };
}

function reactionCount(message) {
  if (!message.reactions) {
    return 0;
  }

  return message.reactions.reduce(
    (count, reaction) => count + (reaction.count ?? 0),
    0,
  );
}

async function getReplies(threadTs) {
  const params = new URLSearchParams({
    channel: SLAMINE_CHANNEL_ID,
    ts: threadTs,
    limit: "100",
  });

  const response = await fetch(
    `https://slack.com/api/conversations.replies?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.messages ?? [];
}

function selectInput(messages, width, height, processed) {
  const inputs = messages
    .filter((message) => message.ts !== undefined)
    .filter((message) => message.thread_ts !== undefined)
    .filter((message) => !processed.has(message.ts))
    .map((message) => {
      const input = parseInput(message.text ?? "", width, height);

      if (input === null) {
        return null;
      }

      return {
        ...input,
        reactions: reactionCount(message),
        ts: message.ts,
      };
    })
    .filter(Boolean);

  if (inputs.length === 0) {
    return null;
  }

  inputs.sort((a, b) => {
    if (b.reactions !== a.reactions) {
      return b.reactions - a.reactions;
    }

    return Number(a.ts) - Number(b.ts);
  });

  const selected = inputs[0];

  return {
    row: selected.row,
    column: selected.column,
    action: selected.action,
    ts: selected.ts,
  };
}

export class Slack {
  constructor({ width, height }) {
    checkEnvironment();

    if (!Number.isInteger(width) || width <= 0) {
      throw new Error("Invalid width");
    }

    if (!Number.isInteger(height) || height <= 0) {
      throw new Error("Invalid height");
    }

    this.width = width;
    this.height = height;
    this.threadTs = null;
    this.processed = new Set();
  }

  async postMap(map) {
    const threadTs = await postMessage(map);

    this.threadTs = threadTs;
    this.processed.clear();

    await postMessage(formatUsage(), threadTs);
  }

  async poll() {
    if (this.threadTs === null) {
      throw new Error("Map has not been posted");
    }

    const messages = await getReplies(this.threadTs);

    const input = selectInput(
      messages,
      this.width,
      this.height,
      this.processed,
    );

    if (input === null) {
      return null;
    }

    this.processed.add(input.ts);

    return {
      row: input.row,
      column: input.column,
      action: input.action,
    };
  }

  async waitForInput() {
    while (true) {
      const input = await this.poll();

      if (input !== null) {
        return input;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, INTERVAL);
      });
    }
  }
}
