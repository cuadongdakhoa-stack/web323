import { db } from "./server/db";
import { drugFormulary } from "./shared/schema";
import { ilike } from "drizzle-orm";

async function check3BTPContraindication() {
  console.log("=== KIỂM TRA MÃ ICD CHỐNG CHỈ ĐỊNH CỦA 3BTP ===\n");

  try {
    const drugs = await db.select()
      .from(drugFormulary)
      .where(ilike(drugFormulary.tradeName, '%3BTP%'));

    if (drugs.length === 0) {
      console.log("❌ Không tìm thấy thuốc 3BTP trong database");
      return;
    }

    drugs.forEach((drug, idx) => {
      console.log(`\n${idx + 1}. Thuốc: ${drug.tradeName}`);
      console.log(`   Hoạt chất: ${drug.activeIngredient}`);
      console.log(`   Mã ICD patterns: ${drug.icdPatterns || 'Chưa có'}`);
      console.log(`   Mã ICD chống chỉ định: ${drug.contraindicationIcds || 'Chưa có'}`);

      if (drug.contraindicationIcds) {
        const icds = drug.contraindicationIcds.split(',').map(s => s.trim());
        console.log(`   📊 Số lượng: ${icds.length} mã`);
        
        // Kiểm tra L30.0 và L30.9
        const hasL30_0 = icds.includes('L30.0');
        const hasL30_9 = icds.includes('L30.9');
        
        console.log(`\n   🔍 Kiểm tra:`);
        console.log(`      L30.0: ${hasL30_0 ? '✅ CÓ' : '❌ THIẾU'}`);
        console.log(`      L30.9: ${hasL30_9 ? '✅ CÓ' : '❌ THIẾU'}`);

        if (hasL30_0 && hasL30_9) {
          console.log(`\n   ✅ HOÀN HẢO! 3BTP đã có đủ L30.0 và L30.9`);
        } else {
          console.log(`\n   ⚠️ CẦN CẬP NHẬT! Thiếu mã L30.x`);
        }

        // Hiển thị nhóm L
        console.log(`\n   📋 Các mã L (Viêm da):`);
        const lCodes = icds.filter(code => code.startsWith('L'));
        lCodes.forEach(code => {
          console.log(`      - ${code}`);
        });
      }
    });

    console.log("\n=== HOÀN TẤT ===");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Lỗi:", error.message);
    process.exit(1);
  }
}

check3BTPContraindication();
