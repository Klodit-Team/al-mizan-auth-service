import amqp from 'amqplib';
export declare function connectRabbitMQ(): Promise<void>;
export declare function getChannel(): amqp.Channel;
export declare function publishToExchange(routingKey: string, message: any): Promise<void>;
export declare function consumeUserRegisteredResponse(): Promise<void>;
export declare function consumeUserRegisteredFailed(): Promise<void>;
export interface UserRegisteredResponsePayload {
    event_id: string;
    correlation_id: string;
    user_id: string;
    email: string;
    role: string;
    langue?: string;
    status: 'success' | 'failed';
    organisation_id?: string;
    profile_id?: string;
    service_contractant_id?: string;
    operateur_economique_id?: string;
    reason?: string;
    processed_at: string;
}
export interface NotificationUserPayload {
    event_id: string;
    correlation_id: string;
    user_id: string;
    email: string;
    action: 'USER_REGISTERED';
    langue: string;
    sent_at: string;
}
//# sourceMappingURL=rabbitmq.d.ts.map