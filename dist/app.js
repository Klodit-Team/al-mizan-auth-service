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
    await connectRabbitMQ();
    await consumeUserRegisteredResponse();
    await consumeUserRegisteredFailed();
    app.listen(process.env.PORT, () => {
        console.log(`🚀 Auth service running on port ${process.env.PORT}`);
        console.log(`📚 Swagger UI available at http://localhost:${process.env.PORT}/api-docs`);
    });
};
start();
export default app;
//# sourceMappingURL=app.js.map