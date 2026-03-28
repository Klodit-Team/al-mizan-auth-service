import swaggerJsdoc from 'swagger-jsdoc';
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Auth Service API',
            version: '1.0.0',
            description: 'JWT Authentication Service with Refresh Token & Blacklist',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'access_token',
                },
            },
            schemas: {
                RegisterRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com',
                        },
                        password: {
                            type: 'string',
                            minLength: 6,
                            example: 'password123',
                        },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com',
                        },
                        password: {
                            type: 'string',
                            example: 'password123',
                        },
                    },
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Operation successful' },
                    },
                },
                UserResponse: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Error message' },
                    },
                },
                SessionResponse: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        deviceInfo: { type: 'string', example: 'Chrome Windows' },
                        ipAddress: { type: 'string', example: '192.168.1.1' },
                        createdAt: { type: 'string', format: 'date-time' },
                        expiresAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'], // lire les annotations dans les routes
};
const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
//# sourceMappingURL=swagger.js.map