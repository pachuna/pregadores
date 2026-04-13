const { PrismaClient } = require("./src/generated/prisma/client.js");
const prisma = new PrismaClient();
async function main() {
  const subs = await prisma.pushSubscription.findMany({
    include: { user: { select: { email: true, role: true } } }
  });
  console.log("Total subscriptions:", subs.length);
  subs.forEach(s => console.log(" -", s.user.email, s.user.role, s.endpoint.substring(0,60)));
}
main().catch(console.error).finally(() => prisma.$disconnect());
