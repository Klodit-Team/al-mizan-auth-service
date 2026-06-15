import amqp from 'amqplib';
let channel;
const EXCHANGE_NAME = 'al-mizan.events';
const USER_REGISTERED_RESPONSE_QUEUE = 'user.registered.response';
const USER_REGISTERED_FAILED_QUEUE = 'user.registered.failed';
const NOTIFICATIONS_USER_ROUTING_KEY = 'notifications.user';
export async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, 'topic', {
            durable: true,
        });
        console.log('RabbitMQ connected successfully');
    }
    catch (error) {
        console.error('RabbitMQ connection failed:', error);
        throw error;
    }
}
export function getChannel() {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized');
    }
    return channel;
}
export async function publishToExchange(routingKey, message) {
    if (!channel) {
        console.error('RabbitMQ channel not established');
        return false;
    }
    try {
        channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log(`Published [${routingKey}]:`, message);
        return true;
    }
    catch (error) {
        console.error('Error publishing to RabbitMQ:', error);
        return false;
    }
}
export async function consumeUserRegisteredResponse() {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized');
    }
    await channel.assertQueue(USER_REGISTERED_RESPONSE_QUEUE, { durable: true });
    await channel.bindQueue(USER_REGISTERED_RESPONSE_QUEUE, EXCHANGE_NAME, 'user.registered.response');
    await channel.consume(USER_REGISTERED_RESPONSE_QUEUE, async (msg) => {
        if (!msg)
            return;
        try {
            const payload = JSON.parse(msg.content.toString());
            if (payload.status === 'success') {
                console.log(`[USER.REGISTERED.RESPONSE] ✓ success → user_id=${payload.user_id}, profile_id=${payload.profile_id}`);
                const notificationPayload = {
                    event_id: payload.event_id,
                    correlation_id: payload.correlation_id,
                    user_id: payload.user_id,
                    email: payload.email,
                    action: 'USER_REGISTERED',
                    langue: payload.langue ?? 'fr',
                    sent_at: new Date().toISOString(),
                };
                await publishToExchange(NOTIFICATIONS_USER_ROUTING_KEY, notificationPayload);
                console.log(`[NOTIFICATIONS.USER] queued → user_id=${payload.user_id}, email=${payload.email}, langue=${notificationPayload.langue}`);
            }
            else {
                console.error(`[USER.REGISTERED.RESPONSE] ✗ failed → user_id=${payload.user_id}, reason=${payload.reason ?? 'Unknown reason'}`);
            }
            channel.ack(msg);
        }
        catch (error) {
            console.error('[USER.REGISTERED.RESPONSE] Invalid payload:', error);
            channel.nack(msg, false, false);
        }
    });
    console.log(`[RabbitMQ] Consumer started on queue: ${USER_REGISTERED_RESPONSE_QUEUE}`);
}
export async function consumeUserRegisteredFailed() {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized');
    }
    await channel.assertQueue(USER_REGISTERED_FAILED_QUEUE, { durable: true });
    await channel.bindQueue(USER_REGISTERED_FAILED_QUEUE, EXCHANGE_NAME, 'user.registered.failed');
    await channel.consume(USER_REGISTERED_FAILED_QUEUE, async (msg) => {
        if (!msg)
            return;
        try {
            const payload = JSON.parse(msg.content.toString());
            console.error(`[USER.REGISTERED.FAILED] ✗ user_id=${payload.user_id}, reason=${payload.reason ?? 'Unknown reason'}`);
            channel.ack(msg);
        }
        catch (error) {
            console.error('[USER.REGISTERED.FAILED] Invalid payload:', error);
            channel.nack(msg, false, false);
        }
    });
    console.log(`[RabbitMQ] Consumer started on queue: ${USER_REGISTERED_FAILED_QUEUE}`);
}
//# sourceMappingURL=rabbitmq.js.map