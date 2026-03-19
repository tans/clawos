const baseUrl = process.env.MISSION_BASE_URL ?? process.env.BBS_BASE_URL ?? "http://127.0.0.1:9090";
const agentId = Number(process.env.AGENT_ID ?? 2);
const pollMs = Number(process.env.POLL_MS ?? 4000);

const handled = new Set<number>();

console.log(`[demo-agent] start agent_id=${agentId} base=${baseUrl}`);

while (true) {
  try {
    const taskResp = await fetch(`${baseUrl}/api/agent/tasks?agent_id=${agentId}&limit=10`);
    if (!taskResp.ok) {
      console.error(`[demo-agent] fetch tasks failed: ${taskResp.status}`);
      await sleep(pollMs);
      continue;
    }

    const payload = (await taskResp.json()) as {
      items: Array<{
        id: number;
        title: string;
        intent: string;
        budget: number | null;
        constraints_json: string;
        selected_proposal_id: number | null;
      }>;
    };

    for (const task of payload.items) {
      if (handled.has(task.id)) continue;
      if (task.selected_proposal_id) continue;

      const constraints = tryParse(task.constraints_json);
      const quantity = Number((constraints as { quantity?: number })?.quantity ?? 100);
      const unitPrice = 450;
      const estimate = quantity * unitPrice;

      const proposal = {
        thread_id: task.id,
        type: "proposal",
        agent_id: agentId,
        summary: `Auto quote for intent=${task.intent}`,
        plan: [
          {
            step: "check_inventory",
            tool: "inventory.lookup",
            args: { sku: `${task.intent}-default` }
          },
          {
            step: "create_quote",
            tool: "quote.create",
            args: { intent: task.intent, total: estimate }
          }
        ],
        cost_estimate: estimate,
        latency_estimate: 60,
        confidence: 0.72,
        as_reply: true
      };

      const proposalResp = await fetch(`${baseUrl}/api/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(proposal)
      });

      if (proposalResp.ok) {
        const created = (await proposalResp.json()) as { id: number };
        handled.add(task.id);
        console.log(`[demo-agent] proposal submitted: mission=${task.id} proposal=${created.id}`);
      } else {
        console.error(`[demo-agent] proposal submit failed: mission=${task.id} status=${proposalResp.status}`);
      }
    }
  } catch (error) {
    console.error("[demo-agent] loop error", error);
  }

  await sleep(pollMs);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryParse(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export {};
