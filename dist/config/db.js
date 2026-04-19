import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ override: true });
const prisma = new PrismaClient();
const init = async () => {
    await prisma.$connect();
    console.log('✅ MySQL connected via Prisma');
};
export default prisma;
export { init };
//# sourceMappingURL=db.js.map