import prisma from '../config/db.js'

export const findByEmail = async (email: string): Promise<any | null> => {
  return await prisma.user.findUnique({ where: { email } })
}

export const findById = async (id: string): Promise<any | null> => {
  return await prisma.user.findUnique({ where: { id } })
}

export const createUser = async (
  email: string,
  password: string,
  role?: string
): Promise<any> => {
  return await prisma.user.create({ data: { email, password, role: (role as any) } })
}

export default { findByEmail, findById, createUser }
