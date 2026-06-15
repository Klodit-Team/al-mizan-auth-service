import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
const app = express();
app.use(express.json());
app.use(cookieParser());
// Routes
app.use('/', authRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
// ✅ Swagger + DB + Redis + RabbitMQ — uniquement hors test
if (process.env.NODE_ENV !== 'test') {
    const { default: swaggerUi } = await import('swagger-ui-express');
    const { default: swaggerSpec } = await import('./config/swagger.js');
    const { init } = await import('./config/db.js');
    const { connect } = await import('./config/redis.js');
    const { connectRabbitMQ, consumeUserRegisteredFailed, consumeUserRegisteredResponse, } = await import('./rabbitmq.js');
    // Expose the raw JSON
    app.get('/api-docs-json', (req, res) => res.json(swaggerSpec));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'Auth Service API Docs',
        swaggerOptions: { persistAuthorization: true },
    }));
    const start = async () => {
        await connect();
        await init();
        if (process.env.RABBITMQ_URL) {
            try {
                await connectRabbitMQ();
                await consumeUserRegisteredResponse();
                await consumeUserRegisteredFailed();
            }
            catch (error) {
                console.warn('⚠️ RabbitMQ unavailable.', error);
            }
        }
        else {
            console.warn('⚠️ RABBITMQ_URL not set.');
        }
        const port = Number(process.env.PORT ?? 3001);
        app.listen(port, () => {
            console.log(`🚀 Auth service running on port ${port}`);
            console.log(`📚 Swagger UI available at http://localhost:${port}/api-docs`);
        });
    };
    start();
}
export default app;
//# sourceMappingURL=app.js.map