const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readProviderResponse(response) {
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* provider returned non-JSON */ }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `مزود الذكاء الاصطناعي رجّع خطأ (${response.status}).`;
    return { error: message, status: response.status };
  }
  if (!data) return { error: "وصل رد فارغ أو غير مفهوم من مزوّد الذكاء الاصطناعي.", status: 502 };
  return { data };
}

function getImageFromInteraction(data) {
  if (data?.output_image?.data) {
    return {
      mimeType: data.output_image.mime_type || "image/png",
      base64: data.output_image.data,
    };
  }
  for (const step of (data?.steps || [])) {
    for (const part of (step?.content || [])) {
      if ((part?.type === "image" || part?.type === "output_image") && part?.data) {
        return { mimeType: part.mime_type || "image/png", base64: part.data };
      }
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ configured: Boolean(env.GEMINI_API_KEY) });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return json({ error: "مفتاح Gemini مش متضاف في Cloudflare. أضف Secret باسم GEMINI_API_KEY." }, 503);
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "بيانات الطلب مش بصيغة JSON صحيحة." }, 400); }
      const message = typeof body?.message === "string" ? body.message.trim().slice(0, 5000) : "";
      if (!message) return json({ error: "اكتب سؤالك الأول." }, 400);

      const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
      const contents = history
        .filter(item => item && typeof item.content === "string" && ["user", "assistant"].includes(item.role))
        .map(item => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content.slice(0, 5000) }],
        }));
      contents.push({ role: "user", parts: [{ text: message }] });

      let response;
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "أنت Otaku AI، مساعد عربي ودود متخصص في الأنمي والمانجا والمانهوا. أجب بدقة، ووضّح عدم اليقين ولا تختلق معلومات عن الفصول الحديثة. لا تنسخ صفحات مانجا محمية بحقوق النشر." }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
          }),
        });
      } catch {
        return json({ error: "تعذّر الاتصال بخدمة Gemini. جرّب مرة أخرى بعد قليل." }, 502);
      }
      const result = await readProviderResponse(response);
      if (result.error) return json({ error: result.error }, result.status);
      const answer = (result.data.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "").join("").trim();
      if (!answer) return json({ error: "Gemini رجّع ردًا فاضيًا. جرّب سؤالًا تانيًا." }, 502);
      return json({ answer });
    }

    if (url.pathname === "/api/image" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return json({ error: "مفتاح Gemini مش متضاف في Cloudflare. أضف Secret باسم GEMINI_API_KEY." }, 503);
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "بيانات الطلب مش بصيغة JSON صحيحة." }, 400); }
      const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 1800) : "";
      if (!prompt) return json({ error: "اكتب وصف الصورة الأول." }, 400);

      let response;
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            model: env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
            input: `Create an original manga/anime illustration. Do not imitate a specific living artist or copy existing copyrighted characters. Prompt: ${prompt}`,
            response_format: { type: "image", mime_type: "image/png", aspect_ratio: "1:1", image_size: "1K" },
          }),
        });
      } catch {
        return json({ error: "تعذّر الاتصال بخدمة إنشاء الصور. جرّب مرة أخرى بعد قليل." }, 502);
      }
      const result = await readProviderResponse(response);
      if (result.error) return json({ error: result.error }, result.status);
      const image = getImageFromInteraction(result.data);
      if (!image) {
        const textOutput = result.data.output_text || "";
        return json({ error: textOutput || "الخدمة ردّت، لكنها لم تُرجع صورة. قد لا يكون نموذج الصور متاحًا لمفتاحك أو خطتك الحالية." }, 502);
      }
      return json({ image: `data:${image.mimeType};base64,${image.base64}` });
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "المسار غير موجود." }, 404);
    return env.ASSETS.fetch(request);
  },
};
