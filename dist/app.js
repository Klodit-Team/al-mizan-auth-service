import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import { init } from './config/db.js';
import { connect } from './config/redis.js';
import authRoutes from './routes/authRoutes.js';
import { connectRabbitMQ, consumeUserRegisteredFailed, consumeUserRegisteredResponse, } from './rabbitmq.js';
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Auth Service API Docs',
    swaggerOptions: { persistAuthorization: true },
}));
app.use('/', authRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
const start = async () => {
    await connect();
    await init();
    // RabbitMQ is optional for auth HTTP availability.
    // If it is down, auth endpoints should still boot to avoid gateway 502.
    if (process.env.RABBITMQ_URL) {
        try {
            await connectRabbitMQ();
            await consumeUserRegisteredResponse();
            await consumeUserRegisteredFailed();
        }
        catch (error) {
            console.warn('⚠️ RabbitMQ unavailable. Continuing without event consumers.', error);
        }
    }
    else {
        console.warn('⚠️ RABBITMQ_URL not set. Starting auth service without RabbitMQ integration.');
    }
    const port = Number(process.env.PORT ?? 3001);
    app.listen(port, () => {
        console.log(`🚀 Auth service running on port ${port}`);
        console.log(`📚 Swagger UI available at http://localhost:${port}/api-docs`);
    });
};
start();
export default app;
//# sourceMappingURL=app.js.map