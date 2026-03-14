import { Role } from '@prisma/client'

export interface CreateUserDto {
  email: string
  password: string
  role?: Role
}

export interface UserResponse {
  id: string
  email: string
  role: Role
  created_at: Date
}