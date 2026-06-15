import { createClient } from 'redis';
const client = createClient({ url: process.env.REDIS_URL });
client.on('error', (err) => console.error('❌ Redis error:', err));
const connect = async () => {
    await client.connect();
    console.log('Redis connected');
};
export { client, connect };
//# sourceMappingURL=redis.js.map