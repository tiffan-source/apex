import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { GoogleGenAI } from "npm:@google/genai";

// il faut un meilleur archi de ce mini server...mais a voir plus tard car potentiel passage vers une architecture client-server

const MODEL = "gemini-3.8-flash";
const SYSTEM_INSTRUCTION = ""

const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });

function mapInteraction(interaction: any) {
  const toolCalls = interaction.steps
    .filter((s: any) => s.type === "function_call")
    .map((s: any) => ({ id: s.id, name: s.name, arguments: s.arguments }));

  return toolCalls.length > 0
    ? { type: "tool-call", interactionId: interaction.id, toolCall: toolCalls }
    : { type: "message", interactionId: interaction.id, content: interaction.output_text ?? "" };
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    console.log(Deno.env.get("GEMINI_API_KEY"));
    console.log("httpGeminiInteractiveAiProvider called");
    console.log("user", ctx.auth);
    // let userId = ctx.auth?.user?.id;
    // if (!userId) {
    //   return Response.json({ error: "unauthorized" }, { status: 401 });
    // }
    const body = await req.json();
    try {
      if (body.action === "generateMessage") {
        const { input } = body;
        const interaction = await ai.interactions.create({
          model: MODEL,
          input: input.prompt,
          system_instruction: SYSTEM_INSTRUCTION,
          previous_interaction_id: input.previousInteractionId,
          tools: input.tools?.map((t: any) => ({
            type: "function",
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        });
        return Response.json(mapInteraction(interaction));
      }

      if (body.action === "sendToolCallResult") {
        const { interactionId, toolCallResult } = body;
        const interaction = await ai.interactions.create({
          model: MODEL,
          previous_interaction_id: interactionId,
          input: toolCallResult.map((r: any) => ({
            type: "function_result",
            name: r.functionName,
            call_id: r.id,
            result: [{ type: "text", text: JSON.stringify(r.result) }],
          })),
        });
        return Response.json(mapInteraction(interaction));
      }

      return Response.json({ error: "unknown action" }, { status: 400 });
    } catch (e) {
      console.error(e);
      return Response.json({ error: "ai_error" }, { status: 502 });
    }
  }),
};
