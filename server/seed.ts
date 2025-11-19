import "dotenv/config";
import { storage } from "./storage";

const FIXED_USERS = [
  {
    username: "admin_cd",
    password: "admin123",
    fullName: "Quản trị viên Cửa Đông",
    role: "admin",
    department: "Quản lý hệ thống"
  },
  {
    username: "duoc1",
    password: "duoc123",
    fullName: "Dược sĩ Nguyễn Văn A",
    role: "pharmacist",
    department: "Khoa Dược"
  },
  {
    username: "duoc2",
    password: "duoc123",
    fullName: "Dược sĩ Trần Thị B",
    role: "pharmacist",
    department: "Khoa Dược"
  },
  {
    username: "bsnoi",
    password: "bsnoi123",
    fullName: "Bác sĩ Lê Văn C",
    role: "doctor",
    department: "Khoa Nội"
  },
  {
    username: "bsicu",
    password: "bsicu123",
    fullName: "Bác sĩ Phạm Thị D",
    role: "doctor",
    department: "Khoa Hồi sức cấp cứu"
  }
];

export async function seedUsers() {
  console.log("🌱 Seeding users...");
  
  for (const userData of FIXED_USERS) {
    const existingUser = await storage.getUserByUsername(userData.username);
    if (!existingUser) {
      await storage.createUser(userData);
      console.log(`✅ Created user: ${userData.username} - ${userData.fullName}`);
    } else {
      console.log(`⏭️  User already exists: ${userData.username}`);
    }
  }
  
  console.log("✨ User seeding completed!");
}

seedUsers()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error seeding users:", error);
    process.exit(1);
  });
