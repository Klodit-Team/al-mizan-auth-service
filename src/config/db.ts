import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

const init = async (): Promise<void> => {
  await prisma.$connect()
  console.log('✅ PostgreSQL connected via Prisma')
}

export default prisma
export { init }
