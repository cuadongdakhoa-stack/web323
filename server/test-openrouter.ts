import { callDeepSeek, callPerplexity } from "./openrouter";

async function testOpenRouterAPIs() {
  console.log("🧪 Testing OpenRouter API connections...\n");

  try {
    console.log("1️⃣ Testing DeepSeek API...");
    const deepseekResponse = await callDeepSeek(
      "Bạn là trợ lý AI",
      "Xin chào! Giới thiệu ngắn gọn về bạn."
    );
    console.log("✅ DeepSeek working!");
    console.log("Response:", deepseekResponse.substring(0, 100) + "...\n");
  } catch (error: any) {
    console.error("❌ DeepSeek failed:", error.message, "\n");
  }

  try {
    console.log("2️⃣ Testing Perplexity API...");
    const perplexityResponse = await callPerplexity(
      "Bạn là trợ lý nghiên cứu",
      "Paracetamol liều tối đa cho người lớn là bao nhiêu?"
    );
    console.log("✅ Perplexity working!");
    console.log("Response:", perplexityResponse.substring(0, 100) + "...\n");
  } catch (error: any) {
    console.error("❌ Perplexity failed:", error.message, "\n");
  }

  console.log("✨ Test completed!");
}

testOpenRouterAPIs();
