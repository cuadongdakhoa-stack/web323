import "dotenv/config";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

async function testGPT4() {
  console.log("🧪 Testing GPT-4 connection via OpenRouter...\n");
  
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not found in .env");
    return;
  }
  
  console.log("✅ API Key found:", OPENROUTER_API_KEY.substring(0, 20) + "...\n");

  try {
    console.log("📡 Calling GPT-4 (openai/gpt-4o)...");
    
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://cuadongcare.com",
        "X-Title": "Cua Dong Care+ Pharma",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: "Bạn là trợ lý y tế chuyên nghiệp." },
          { role: "user", content: "Chào bạn! Giới thiệu ngắn gọn về khả năng của bạn trong việc phân tích ca bệnh." }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ API Error (${response.status}):`, error);
      return;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;
    
    if (message) {
      console.log("✅ GPT-4 Connected Successfully!\n");
      console.log("📝 Response:");
      console.log("─".repeat(60));
      console.log(message);
      console.log("─".repeat(60));
      console.log("\n✨ Model:", data.model);
      console.log("💰 Tokens used:", data.usage?.total_tokens || "N/A");
    } else {
      console.error("❌ No message in response:", JSON.stringify(data, null, 2));
    }
    
  } catch (error: any) {
    console.error("❌ Connection failed:", error.message);
  }
}

testGPT4();
