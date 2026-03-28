import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
const init = async () => {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected via Prisma');
};
export default prisma;
export { init };
//# sourceMappingURL=db.js.map