import { createClient } from 'redis'
import type { RedisClientType } from 'redis'

const client: RedisClientType = createClient({ url: process.env.REDIS_URL as string })

client.on('error', (err: unknown) => console.error('❌ Redis error:', err))

const connect = async (): Promise<void> => {
  await client.connect()
  console.log('Redis connected')
}

export { client, connect }
