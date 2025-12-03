/**
 * Script kiểm tra và cập nhật ICD chống chỉ định cho 3BTP
 * Chạy: npx tsx update-3btp-icd.ts
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment");
  console.log("\n💡 Hướng dẫn:");
  console.log("1. Copy .env file");
  console.log("2. Chạy lại script");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function check3BTPContraindication() {
  console.log("=== KIỂM TRA MÃ ICD CHỐNG CHỈ ĐỊNH CỦA 3BTP ===\n");

  try {
    // Query tất cả thuốc có tên chứa "3BTP"
    const drugs = await sql`
      SELECT 
        id,
        trade_name,
        active_ingredient,
        icd_patterns,
        contraindication_icds
      FROM drug_formulary
      WHERE LOWER(trade_name) LIKE '%3btp%'
    `;

    if (drugs.length === 0) {
      console.log("❌ Không tìm thấy thuốc 3BTP trong database");
      console.log("\n💡 Có thể thuốc chưa được import vào database.");
      console.log("   Chạy seed script để import dữ liệu.");
      process.exit(1);
    }

    for (const drug of drugs) {
      console.log(`\n📦 Thuốc: ${drug.trade_name}`);
      console.log(`   Hoạt chất: ${drug.active_ingredient || 'Chưa có'}`);
      console.log(`   Mã ICD chỉ định (patterns): ${drug.icd_patterns || 'Chưa có'}`);
      console.log(`   Mã ICD chống chỉ định:\n   ${drug.contraindication_icds || 'Chưa có'}\n`);

      if (drug.contraindication_icds) {
        const icds = drug.contraindication_icds.split(',').map((s: string) => s.trim());
        console.log(`   📊 Số lượng: ${icds.length} mã ICD`);

        // Kiểm tra L30.0 và L30.9
        const hasL30_0 = icds.includes('L30.0');
        const hasL30_9 = icds.includes('L30.9');

        console.log(`\n   🔍 Kiểm tra các mã cần thiết:`);
        console.log(`      L30.0 (Viêm da tiền xu): ${hasL30_0 ? '✅ CÓ' : '❌ THIẾU'}`);
        console.log(`      L30.9 (Viêm da không xác định): ${hasL30_9 ? '✅ CÓ' : '❌ THIẾU'}`);

        if (hasL30_0 && hasL30_9) {
          console.log(`\n   ✅ HOÀN HẢO! 3BTP đã có đủ L30.0 và L30.9`);
        } else {
          console.log(`\n   ⚠️ CẦN CẬP NHẬT! Thiếu mã L30.x`);
          console.log(`\n   🔧 Đang cập nhật database...`);

          // Thêm L30.0 và L30.9 nếu chưa có
          let updatedIcds = icds;
          if (!hasL30_0) updatedIcds.push('L30.0');
          if (!hasL30_9) updatedIcds.push('L30.9');

          const newIcdString = updatedIcds.join(', ');

          await sql`
            UPDATE drug_formulary
            SET contraindication_icds = ${newIcdString}
            WHERE id = ${drug.id}
          `;

          console.log(`   ✅ Đã cập nhật! Số lượng mới: ${updatedIcds.length} mã`);
        }

        // Hiển thị tất cả mã L (Viêm da/chàm)
        console.log(`\n   📋 Tất cả các mã L (Viêm da/Chàm):`);
        const lCodes = icds.filter((code: string) => code.startsWith('L')).sort();
        lCodes.forEach((code: string) => {
          const descriptions: Record<string, string> = {
            'L20.0': 'Viêm da dị ứng mảng',
            'L20.81': 'Viêm da dị ứng thể khác',
            'L20.82': 'Viêm da dị ứng thể khác',
            'L20.83': 'Viêm da dị ứng thể khác',
            'L20.89': 'Viêm da dị ứng thể khác',
            'L20.9': 'Viêm da dị ứng không xác định',
            'L30.0': 'Viêm da tiền xu',
            'L30.9': 'Viêm da không xác định',
          };
          const desc = descriptions[code] || '';
          console.log(`      - ${code}${desc ? ` (${desc})` : ''}`);
        });

        // Hiển thị tóm tắt các nhóm ICD
        console.log(`\n   📊 Tóm tắt theo nhóm:`);
        const jCodes = icds.filter((code: string) => code.startsWith('J'));
        const cCodes = icds.filter((code: string) => code.startsWith('C'));
        const rCodes = icds.filter((code: string) => code.startsWith('R'));

        console.log(`      J (Hen phế quản): ${jCodes.length} mã`);
        console.log(`      L (Viêm da/Chàm): ${lCodes.length} mã`);
        console.log(`      C (Ung thư): ${cCodes.length} mã`);
        console.log(`      R (Tổn thương phổi): ${rCodes.length} mã`);
      }
    }

    console.log("\n=== HOÀN TẤT ===");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ LỖI:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

check3BTPContraindication();
